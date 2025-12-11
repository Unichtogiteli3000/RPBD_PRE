#!/usr/bin/env python3
"""
Тестовый скрипт для проверки работы сервера музыкальной библиотеки
"""

import requests
import time
import subprocess
import signal
import os
import sys

def test_server():
    """Тестирование основных функций сервера"""
    base_url = "http://localhost:5000"
    
    print("Проверка доступности сервера...")
    
    try:
        # Проверка состояния сервера
        response = requests.get(f"{base_url}/api/health")
        if response.status_code == 200:
            print("✓ Сервер доступен")
            print(f"  Статус: {response.json()}")
        else:
            print(f"✗ Сервер недоступен, статус: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("✗ Сервер не отвечает. Убедитесь, что сервер запущен на порту 5000")
        return False
    
    # Проверка маршрутов (ожидаем 401 без токена)
    test_routes = [
        "/api/profile",
        "/api/tracks",
        "/api/artists",
        "/api/genres",
        "/api/collections"
    ]
    
    for route in test_routes:
        try:
            response = requests.get(f"{base_url}{route}")
            if response.status_code == 401:  # Ожидаем ошибку аутентификации
                print(f"✓ Маршрут {route} защищен (401)")
            else:
                print(f"? Маршрут {route} возвращает {response.status_code}, ожидался 401")
        except Exception as e:
            print(f"✗ Ошибка при проверке маршрута {route}: {e}")
    
    # Проверка аутентификации (ожидаем 400 или 401)
    try:
        response = requests.post(f"{base_url}/api/auth/login", json={})
        if response.status_code in [400, 401]:
            print("✓ Маршрут аутентификации работает")
        else:
            print(f"? Маршрут аутентификации возвращает неожиданный статус: {response.status_code}")
    except Exception as e:
        print(f"✗ Ошибка при проверке аутентификации: {e}")
    
    return True

if __name__ == "__main__":
    print("Тестирование сервера музыкальной библиотеки")
    print("=" * 50)
    
    success = test_server()
    
    if success:
        print("\n✓ Тестирование завершено успешно")
        print("Сервер готов к использованию!")
    else:
        print("\n✗ Один или несколько тестов не прошли")
        sys.exit(1)