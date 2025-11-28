// ==============================
// 内存存储（Worker 重启后数据丢失）
// ==============================
let inMemoryStore = {
  devices: {},    // { device_id: { alias, last_online } }
  commands: {},   // { device_id: { command, status, timestamp } }
  echoes: {}      // { device_id: { output, error, timestamp } }
};

// ==============================
// 工具函数
// ==============================
// 格式化时间戳：YYYY-MM-DD HH:MM:SS
function formatTimestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// 安全解析 JSON
async function safeParseJSON(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

// 重置内存存储（可选调用）
function resetStore() {
  inMemoryStore = { devices: {}, commands: {}, echoes: {} };
}

// ==============================
// 接口处理函数
// ==============================
// 1. 被控端 - 心跳/注册接口
async function deviceHeartbeat(request) {
  const body = await safeParseJSON(request);
  const deviceId = body.device_id;

  if (!deviceId) {
    return new Response(JSON.stringify({ code: 400, msg: "设备ID不能为空" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    });
  }

  // 新设备注册/旧设备更新在线时间
  if (!inMemoryStore.devices[deviceId]) {
    inMemoryStore.devices[deviceId] = {
      alias: deviceId,
      last_online: formatTimestamp()
    };
  } else {
    inMemoryStore.devices[deviceId].last_online = formatTimestamp();
  }

  return new Response(JSON.stringify({
    code: 200,
    msg: "心跳成功",
    alias: inMemoryStore.devices[deviceId].alias
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// 2. 被控端 - 获取指令接口
async function getCommand(request) {
  const body = await safeParseJSON(request);
  const deviceId = body.device_id;

  if (!deviceId) {
    return new Response(JSON.stringify({ code: 400, msg: "设备ID不能为空" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    });
  }

  // 检查未执行指令
  const cmd = inMemoryStore.commands[deviceId];
  if (cmd && cmd.status === "pending") {
    return new Response(JSON.stringify({
      code: 200,
      command: cmd.command,
      timestamp: cmd.timestamp
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ code: 204, msg: "无未执行指令" }), {
    headers: { "Content-Type": "application/json" },
    status: 204
  });
}

// 3. 被控端 - 上传回显接口
async function uploadEcho(request) {
  const body = await safeParseJSON(request);
  const deviceId = body.device_id;
  const output = body.output || "";
  const error = body.error || "";

  if (!deviceId) {
    return new Response(JSON.stringify({ code: 400, msg: "设备ID不能为空" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    });
  }

  // 存储回显
  inMemoryStore.echoes[deviceId] = {
    output,
    error,
    timestamp: formatTimestamp()
  };

  // 标记指令为已执行
  if (inMemoryStore.commands[deviceId]) {
    inMemoryStore.commands[deviceId].status = "executed";
  }

  return new Response(JSON.stringify({ code: 200, msg: "回显上传成功" }), {
    headers: { "Content-Type": "application/json" }
  });
}

// 4. 控制端 - 获取设备列表接口
async function getDevices() {
  // 格式化设备列表
  const devices = Object.entries(inMemoryStore.devices).map(([device_id, info]) => ({
    device_id,
    alias: info.alias,
    last_online: info.last_online
  }));

  return new Response(JSON.stringify({ code: 200, devices }), {
    headers: { "Content-Type": "application/json" }
  });
}

// 5. 控制端 - 修改设备别名接口
async function setAlias(request) {
  const body = await safeParseJSON(request);
  const deviceId = body.device_id;
  const newAlias = body.new_alias;

  if (!deviceId || !newAlias) {
    return new Response(JSON.stringify({ code: 400, msg: "设备ID和新别名不能为空" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    });
  }

  if (!inMemoryStore.devices[deviceId]) {
    return new Response(JSON.stringify({ code: 404, msg: "设备不存在" }), {
      headers: { "Content-Type": "application/json" },
      status: 404
    });
  }

  // 更新别名
  inMemoryStore.devices[deviceId].alias = newAlias;

  return new Response(JSON.stringify({
    code: 200,
    msg: "别名修改成功",
    new_alias: newAlias
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// 6. 控制端 - 发送指令接口
async function sendCommand(request) {
  const body = await safeParseJSON(request);
  const deviceId = body.device_id;
  const command = body.command;

  if (!deviceId || !command) {
    return new Response(JSON.stringify({ code: 400, msg: "设备ID和指令不能为空" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    });
  }

  if (!inMemoryStore.devices[deviceId]) {
    return new Response(JSON.stringify({ code: 404, msg: "设备不存在" }), {
      headers: { "Content-Type": "application/json" },
      status: 404
    });
  }

  // 存储指令（覆盖原有未执行指令）
  inMemoryStore.commands[deviceId] = {
    command,
    status: "pending",
    timestamp: formatTimestamp()
  };

  return new Response(JSON.stringify({ code: 200, msg: "指令发送成功" }), {
    headers: { "Content-Type": "application/json" }
  });
}

// 7. 控制端 - 获取回显接口
async function getEcho(request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id");

  if (!deviceId) {
    return new Response(JSON.stringify({ code: 400, msg: "设备ID不能为空" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    });
  }

  const echo = inMemoryStore.echoes[deviceId];
  if (!echo) {
    return new Response(JSON.stringify({ code: 204, msg: "无回显数据" }), {
      headers: { "Content-Type": "application/json" },
      status: 204
    });
  }

  return new Response(JSON.stringify({
    code: 200,
    ...echo
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// ==============================
// CORS 配置 + 主路由
// ==============================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // 生产环境替换为你的域名
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 处理 OPTIONS 预检请求
function handleOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

// 主路由分发
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 处理 CORS 预检
  if (method === "OPTIONS") {
    return handleOptions();
  }

  // 路由匹配
  try {
    // 被控端接口
    if (path === "/device/heartbeat" && method === "POST") {
      const res = await deviceHeartbeat(request);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    if (path === "/device/get_command" && method === "POST") {
      const res = await getCommand(request);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    if (path === "/device/upload_echo" && method === "POST") {
      const res = await uploadEcho(request);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // 控制端接口
    if (path === "/control/get_devices" && method === "GET") {
      const res = await getDevices();
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    if (path === "/control/set_alias" && method === "POST") {
      const res = await setAlias(request);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    if (path === "/control/send_command" && method === "POST") {
      const res = await sendCommand(request);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    if (path === "/control/get_echo" && method === "GET") {
      const res = await getEcho(request);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // 404 接口不存在
    return new Response(JSON.stringify({ code: 404, msg: "接口不存在" }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 404
    });
  } catch (error) {
    // 500 服务器错误
    return new Response(JSON.stringify({ code: 500, msg: "服务器内部错误" }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 500
    });
  }
}

// ==============================
// Workers 入口
// ==============================
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
