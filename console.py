import requests
import json
from datetime import datetime

# API服务器地址（需与被控端、API服务器一致）
API_SERVER = "http://127.0.0.1:5000"

def print_menu():
    """打印功能菜单"""
    print("\n" + "="*50)
    print("远程控制端")
    print("="*50)
    print("1. 查看在线设备列表")
    print("2. 修改设备别名")
    print("3. 发送指令到设备")
    print("4. 查看设备指令回显")
    print("0. 退出程序")
    print("="*50)

def get_devices():
    """获取设备列表"""
    try:
        response = requests.get(f"{API_SERVER}/control/get_devices", timeout=10)
        if response.status_code == 200:
            devices = response.json()["devices"]
            if not devices:
                print("暂无在线设备")
                return []
            print(f"\n在线设备列表（共{len(devices)}台）:")
            print(f"{'序号':<5} {'设备ID':<36} {'别名':<20} {'最后在线时间':<20}")
            print("-"*80)
            for i, dev in enumerate(devices, 1):
                print(f"{i:<5} {dev['device_id']:<36} {dev['alias']:<20} {dev['last_online']:<20}")
            return devices
        else:
            print(f"获取设备列表失败: {response.json().get('msg')}")
            return []
    except Exception as e:
        print(f"获取设备列表异常: {str(e)}")
        return []

def set_alias():
    """修改设备别名"""
    devices = get_devices()
    if not devices:
        return
    
    try:
        dev_index = int(input("\n请输入要修改别名的设备序号: ")) - 1
        if dev_index < 0 or dev_index >= len(devices):
            print("输入序号无效")
            return
        
        device = devices[dev_index]
        new_alias = input(f"当前别名为「{device['alias']}」，请输入新别名: ").strip()
        if not new_alias:
            print("别名不能为空")
            return
        
        # 发送修改请求
        response = requests.post(
            f"{API_SERVER}/control/set_alias",
            json={
                "device_id": device["device_id"],
                "new_alias": new_alias
            },
            timeout=10
        )
        if response.status_code == 200:
            print(f"别名修改成功！新别名为：{new_alias}")
        else:
            print(f"别名修改失败: {response.json().get('msg')}")
    except ValueError:
        print("输入序号必须为数字")
    except Exception as e:
        print(f"修改别名异常: {str(e)}")

def send_command():
    """发送指令到设备"""
    devices = get_devices()
    if not devices:
        return
    
    try:
        dev_index = int(input("\n请输入要发送指令的设备序号: ")) - 1
        if dev_index < 0 or dev_index >= len(devices):
            print("输入序号无效")
            return
        
        device = devices[dev_index]
        command = input(f"请输入要发送给「{device['alias']}」的指令: ").strip()
        if not command:
            print("指令不能为空")
            return
        
        # 发送指令请求
        response = requests.post(
            f"{API_SERVER}/control/send_command",
            json={
                "device_id": device["device_id"],
                "command": command
            },
            timeout=10
        )
        if response.status_code == 200:
            print(f"指令发送成功！请等待设备执行（设备每5秒检查一次指令）")
        else:
            print(f"指令发送失败: {response.json().get('msg')}")
    except ValueError:
        print("输入序号必须为数字")
    except Exception as e:
        print(f"发送指令异常: {str(e)}")

def get_echo():
    """查看设备指令回显"""
    devices = get_devices()
    if not devices:
        return
    
    try:
        dev_index = int(input("\n请输入要查看回显的设备序号: ")) - 1
        if dev_index < 0 or dev_index >= len(devices):
            print("输入序号无效")
            return
        
        device = devices[dev_index]
        print(f"\n正在获取「{device['alias']}」的最新回显...")
        
        # 获取回显请求
        response = requests.get(
            f"{API_SERVER}/control/get_echo",
            params={"device_id": device["device_id"]},
            timeout=10
        )
        if response.status_code == 200:
            echo = response.json()
            print(f"\n回显信息（{echo['timestamp']}）:")
            print("-"*50)
            print(f"输出内容:\n{echo['output'] or '无'}")
            print("-"*50)
            print(f"错误信息:\n{echo['error'] or '无'}")
            print("-"*50)
        elif response.status_code == 204:
            print("该设备暂无指令回显数据")
        else:
            print(f"获取回显失败: {response.json().get('msg')}")
    except ValueError:
        print("输入序号必须为数字")
    except Exception as e:
        print(f"获取回显异常: {str(e)}")

def main():
    print("=== 远程控制端启动 ===")
    print(f"连接API服务器: {API_SERVER}")
    
    while True:
        print_menu()
        choice = input("\n请输入功能序号: ").strip()
        if choice == "0":
            print("退出程序...")
            break
        elif choice == "1":
            get_devices()
        elif choice == "2":
            set_alias()
        elif choice == "3":
            send_command()
        elif choice == "4":
            get_echo()
        else:
            print("输入无效，请重新选择")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n强制退出程序")
    except Exception as e:
        print(f"程序异常退出: {str(e)}")
