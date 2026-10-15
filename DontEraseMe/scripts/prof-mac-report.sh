#!/usr/bin/env bash
# Mac 性能一键测试：自动跑全部压力场景 + 回归实验，报告汇总到 prof-mac-report.txt
#
# 用法（家里 Mac，一次性准备：npm i --no-save playwright，需本机装有 Chrome）：
#   终端A: cd DontEraseMe && npm run dev -- --port 5174 --strictPort   # 保持运行
#   终端B: cd DontEraseMe && bash scripts/prof-mac-report.sh
# 跑完把生成的 prof-mac-report.txt 整个文件发回来。
#
# 说明：有头模式（PROF_HEADFUL=1）更接近真实游玩；测前关掉其他浏览器页/听歌/VPN
# （M5 Air 无风扇，后台负载会降频干扰数据）。
set -u
cd "$(dirname "$0")/.."

REPORT=prof-mac-report.txt
: > "$REPORT"

echo "检查 dev 服务器 http://localhost:5174 ..."
if ! curl -s -o /dev/null --max-time 3 http://localhost:5174; then
    echo "❌ dev 服务器没起来。请先另开终端跑：npm run dev -- --port 5174 --strictPort"
    echo "   起来后重新执行本脚本。"
    exit 1
fi
echo "✅ dev 服务器在线，开始测试（共 5 场景，约 5-10 分钟，测试期间不要操作电脑）。"
echo

{
echo "# Mac 性能测试报告 $(date '+%Y-%m-%d %H:%M:%S')"
echo

echo "==================== 场景1：敌潮 300 敌 30s（基础压力） ===================="
PROF_HEADFUL=1 node scripts/prof-live-run.mjs 30 300 1

echo
echo "==================== 场景2：笔迹洪流 6000 笔迹 30s（笔迹压力） ===================="
PROF_HEADFUL=1 node scripts/prof-live-run.mjs 30 0 1 6000

echo
echo "==================== 场景3：敌潮 300 敌 + CPU×4 30s（模拟降频） ===================="
PROF_HEADFUL=1 node scripts/prof-live-run.mjs 30 300 4

echo
echo "==================== 场景4：敌潮 300 敌 + 关闭每帧clip 30s（第二轮优化回归实验） ===================="
PROF_HEADFUL=1 PROF_NOCLIP=1 node scripts/prof-live-run.mjs 30 300 1

echo
echo "==================== 场景5：敌潮 300 敌 + 关闭全画布消隐 30s（消隐开销实验） ===================="
PROF_HEADFUL=1 PROF_NOFADE=1 node scripts/prof-live-run.mjs 30 300 1

echo
echo "==================== 全部完成 ===================="
} > "$REPORT" 2>&1

echo
echo "✅ 测试完成，报告已写入 $REPORT"
echo "   请把这个文件整个发回（微信/贴对话都可以）。"
