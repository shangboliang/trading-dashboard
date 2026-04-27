[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Invoke-RequiredConfirmation {
    param(
        [Parameter(Mandatory = $true)][string]$Phrase,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$Target
    )

    Write-Host ""
    Write-Host "危险数据库操作" -ForegroundColor Red
    Write-Host "目标: $Target" -ForegroundColor Yellow
    Write-Host "命令: $Command" -ForegroundColor Yellow
    Write-Host "这可能删除或覆盖交易记录、API Key、同步日志等数据。" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "如需继续，请逐字输入：$Phrase"

    return $confirm -eq $Phrase
}

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  PostgreSQL 数据库管理工具" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 检查 PostgreSQL 服务状态"
    Write-Host "2. 启动 PostgreSQL 服务"
    Write-Host "3. 停止 PostgreSQL 服务"
    Write-Host "4. 重启 PostgreSQL 服务"
    Write-Host "5. 安全迁移数据库结构 (prisma migrate dev)"
    Write-Host "6. 危险：强制同步结构并允许数据丢失"
    Write-Host "7. 危险：重置数据库并删除所有数据"
    Write-Host "8. 启动开发服务器"
    Write-Host "0. 退出"
    Write-Host ""
}

while ($true) {
    Show-Menu
    $Choice = Read-Host "请输入选项 (0-8)"

    switch ($Choice) {
        "1" {
            $service = Get-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($service) {
                Write-Host "PostgreSQL 服务状态: $($service.Status)" -ForegroundColor Green
            } else {
                Write-Host "未找到 PostgreSQL 15 服务。" -ForegroundColor Red
            }
            Pause
        }
        "2" {
            Start-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($?) { Write-Host "服务已启动" -ForegroundColor Green } else { Write-Host "启动失败，请以管理员身份运行。" -ForegroundColor Red }
            Pause
        }
        "3" {
            Stop-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($?) { Write-Host "服务已停止" -ForegroundColor Green } else { Write-Host "停止失败，请以管理员身份运行。" -ForegroundColor Red }
            Pause
        }
        "4" {
            Restart-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
            if ($?) { Write-Host "服务已重启" -ForegroundColor Green } else { Write-Host "重启失败，请以管理员身份运行。" -ForegroundColor Red }
            Pause
        }
        "5" {
            Set-Location -Path "$PSScriptRoot\.."
            npm run db:migrate
            Pause
        }
        "6" {
            Set-Location -Path "$PSScriptRoot\.."
            $target = $env:DATABASE_URL
            if ([string]::IsNullOrWhiteSpace($target)) { $target = "当前 .env 中的 DATABASE_URL" }

            if (Invoke-RequiredConfirmation -Phrase "I UNDERSTAND THIS MAY DELETE DATA" -Command "npm run db:danger:push-lossy" -Target $target) {
                npm run db:danger:push-lossy
            } else {
                Write-Host "已取消。" -ForegroundColor Yellow
            }
            Pause
        }
        "7" {
            Set-Location -Path "$PSScriptRoot\.."
            $target = $env:DATABASE_URL
            if ([string]::IsNullOrWhiteSpace($target)) { $target = "当前 .env 中的 DATABASE_URL" }

            if (Invoke-RequiredConfirmation -Phrase "RESET DATABASE" -Command "npm run db:danger:reset" -Target $target) {
                npm run db:danger:reset
            } else {
                Write-Host "已取消。" -ForegroundColor Yellow
            }
            Pause
        }
        "8" {
            Set-Location -Path "$PSScriptRoot\.."
            npm run dev
        }
        "0" {
            exit
        }
        default {
            Write-Host "无效选项，请重新选择。" -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
