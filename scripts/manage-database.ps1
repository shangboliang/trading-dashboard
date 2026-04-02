<#
.SYNOPSIS
PostgreSQL 数据库快速启动与管理脚本

.DESCRIPTION
提供一键式的 PostgreSQL 服务管理、数据库纯净初始化、删除等功能。
支持 UTF-8 编码，防止中文乱码。
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  PostgreSQL 数据库管理工具" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "请选择操作："
    Write-Host ""
    Write-Host "1. 检查 PostgreSQL 服务状态"
    Write-Host "2. 启动 PostgreSQL 服务"
    Write-Host "3. 停止 PostgreSQL 服务"
    Write-Host "4. 重启 PostgreSQL 服务"
    Write-Host "5. 纯净初始化数据库 (仅创建+同步表结构)"
    Write-Host "6. 删除当前数据库 (慎用)"
    Write-Host "7. 启动开发服务器"
    Write-Host "0. 退出"
    Write-Host ""
}

while ($true) {
    Show-Menu
    $Choice = Read-Host "请输入选项 (0-7)"

    switch ($Choice) {
        "1" {
            Write-Host "`n正在检查 PostgreSQL 服务..." -ForegroundColor Yellow
            $service = Get-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($service) {
                Write-Host "✓ PostgreSQL 服务状态: $($service.Status)" -ForegroundColor Green
            } else {
                Write-Host "× 未找到 PostgreSQL 15 服务。请确认是否已安装。" -ForegroundColor Red
            }
            Pause
        }
        "2" {
            Write-Host "`n正在启动 PostgreSQL 服务..." -ForegroundColor Yellow
            Start-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($?) { Write-Host "✓ 服务已启动" -ForegroundColor Green } else { Write-Host "× 启动失败。请以管理员身份运行此脚本。" -ForegroundColor Red }
            Pause
        }
        "3" {
            Write-Host "`n正在停止 PostgreSQL 服务..." -ForegroundColor Yellow
            Stop-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($?) { Write-Host "✓ 服务已停止" -ForegroundColor Green } else { Write-Host "× 停止失败。请以管理员身份运行此脚本。" -ForegroundColor Red }
            Pause
        }
        "4" {
            Write-Host "`n正在重启 PostgreSQL 服务..." -ForegroundColor Yellow
            Restart-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($?) { Write-Host "✓ 服务已重启" -ForegroundColor Green } else { Write-Host "× 重启失败。请以管理员身份运行此脚本。" -ForegroundColor Red }
            Pause
        }
        "5" {
            Write-Host "`n========================================" -ForegroundColor Cyan
            Write-Host "  开始纯净初始化 (不含任何模拟数据)..." -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            
            Write-Host "[1/2] 正在尝试创建 tradingdb 数据库..." -ForegroundColor Yellow
            $env:PGPASSWORD = "yourpassword"
            & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE tradingdb;" postgres 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ 数据库创建成功" -ForegroundColor Green
            } else {
                Write-Host "! 提示：如果数据库已存在，此步骤报错是正常的。" -ForegroundColor DarkYellow
            }

            Write-Host "`n[2/2] 正在同步数据库表结构 (Prisma Push)..." -ForegroundColor Yellow
            Set-Location -Path "$PSScriptRoot\.."
            npx prisma db push --accept-data-loss
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ 表结构同步成功" -ForegroundColor Green
                Write-Host "`n========================================" -ForegroundColor Cyan
                Write-Host "  纯净数据库初始化完成！" -ForegroundColor Cyan
                Write-Host "  现在您可以添加真实的 API Key 进行功能测试。" -ForegroundColor Cyan
                Write-Host "========================================" -ForegroundColor Cyan
            } else {
                Write-Host "× 同步失败，请检查 .env 配置" -ForegroundColor Red
            }
            Pause
        }
        "6" {
            Write-Host "`n========================================" -ForegroundColor Red
            Write-Host "  警告：这将删除当前所有数据！" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            $confirm = Read-Host "确定要删除 tradingdb 数据库吗？(Y/N)"
            if ($confirm -eq 'Y' -or $confirm -eq 'y') {
                Write-Host "`n正在尝试删除 tradingdb 数据库..." -ForegroundColor Yellow
                $env:PGPASSWORD = "yourpassword"
                & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS tradingdb;" postgres
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✓ 数据库已成功删除" -ForegroundColor Green
                } else {
                    Write-Host "× 删除失败，可能有连接正在使用该数据库" -ForegroundColor Red
                }
            } else {
                Write-Host "已取消删除操作。" -ForegroundColor DarkYellow
            }
            Pause
        }
        "7" {
            Write-Host "`n正在启动开发服务器..." -ForegroundColor Yellow
            Set-Location -Path "$PSScriptRoot\.."
            Start-Process "http://localhost:3000"
            npm run dev
        }
        "0" {
            Write-Host "`n再见！`n" -ForegroundColor Cyan
            exit
        }
        default {
            Write-Host "无效的选项，请重新选择。" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
