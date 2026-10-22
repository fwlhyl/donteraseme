#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""管线 A 第 4 步：裁剪 + 对齐透明帧

用法（Mac 终端，在仓库根目录 DontEraseMe/ 下）:
    python3 scripts/crop_align_frames.py <帧文件夹> <输出文件夹>

可选参数:
    --padding N     画布四周留白像素（默认 0）
    --height N      输出统一高度，等比缩放（默认 0=保持原尺寸；
                    实验三问第 2 问"64px 糊不糊"可跑 --height 64 快速看效果）
    --threshold N   alpha 阈值，低于视为透明（默认 10，滤抠绿幕残留噪点）

依赖: Pillow（没有就先装一次: pip3 install pillow）

行为:
    1. 读输入文件夹全部 PNG（按文件名自然排序）
    2. 每帧按 alpha 通道找角色包围盒，裁掉多余留白
    3. 所有帧统一画布（最大包围盒尺寸 + padding），角色居中贴入
    4. 打印每帧包围盒与中心点漂移报告（帮助裁决三问第 3 问"帧漂移可对齐吗"）
    5. 输出 aligned_<原名>.png（顺序与输入一致，供第 5 步拼表）
"""

import argparse
import glob
import os
import re
import sys

from PIL import Image


def natural_key(path):
    """按文件名中的数字自然排序（帧_2 在 帧_10 前面）"""
    name = os.path.basename(path)
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", name)]


def alpha_bbox(img, threshold):
    """返回内容包围盒 (left, top, right, bottom)；alpha<=threshold 视为透明噪声"""
    alpha = img.getchannel("A")
    return alpha.point(lambda p: 255 if p > threshold else 0).getbbox()


def main():
    parser = argparse.ArgumentParser(description="裁剪+对齐透明帧（管线A第4步）")
    parser.add_argument("input_dir", help="抽帧后的透明 PNG 文件夹")
    parser.add_argument("output_dir", help="输出文件夹（自动创建）")
    parser.add_argument("--padding", type=int, default=0, help="画布四周留白像素，默认 0")
    parser.add_argument("--height", type=int, default=0, help="输出统一高度（等比缩放，0=保持原尺寸）")
    parser.add_argument("--threshold", type=int, default=10, help="alpha 阈值，低于视为透明，默认 10")
    args = parser.parse_args()

    frames = sorted(glob.glob(os.path.join(args.input_dir, "*.png")), key=natural_key)
    if len(frames) < 2:
        print(f"[错误] 输入文件夹只找到 {len(frames)} 张 PNG（至少 2 张）：{args.input_dir}")
        sys.exit(1)

    bboxes = {}
    centers = []
    for p in frames:
        img = Image.open(p).convert("RGBA")
        bb = alpha_bbox(img, args.threshold)
        if bb is None:
            print(f"[警告] {os.path.basename(p)} 没有任何不透明像素——抠绿幕可能失败了，回头检查第 2 步输出")
            bb = (0, 0, img.width, img.height)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        if w * h > img.width * img.height * 0.95:
            print(f"[警告] {os.path.basename(p)} 内容占满整帧（{w}x{h}）——大概率绿幕没抠干净（alpha 全白），第 2 步需要重做")
        bboxes[p] = bb
        centers.append(((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2))

    canvas_w = max(b[2] - b[0] for b in bboxes.values()) + args.padding * 2
    canvas_h = max(b[3] - b[1] for b in bboxes.values()) + args.padding * 2

    # 漂移报告（三问裁决第 3 问：帧漂移可对齐吗）
    xs = [c[0] for c in centers]
    ys = [c[1] for c in centers]
    drift_x = max(xs) - min(xs)
    drift_y = max(ys) - min(ys)
    print(f"共 {len(frames)} 帧 | 统一画布 {canvas_w}x{canvas_h}")
    print(f"角色中心最大漂移 X={drift_x:.1f}px Y={drift_y:.1f}px")
    print("（中心对齐会消掉这些漂移；漂移越大=视频模型漂得越厉害，重点看对齐后是否还抖）")

    os.makedirs(args.output_dir, exist_ok=True)
    for p in frames:
        img = Image.open(p).convert("RGBA")
        bb = bboxes[p]
        cropped = img.crop(bb)
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        canvas.paste(cropped, (
            args.padding + (canvas_w - 2 * args.padding - cropped.width) // 2,
            args.padding + (canvas_h - 2 * args.padding - cropped.height) // 2,
        ), cropped)
        if args.height > 0:
            new_w = max(1, round(canvas.width * args.height / canvas.height))
            canvas = canvas.resize((new_w, args.height), Image.LANCZOS)
        out = os.path.join(args.output_dir, "aligned_" + os.path.basename(p))
        canvas.save(out)
    print(f"完成：{len(frames)} 帧已写入 {args.output_dir}（前缀 aligned_）")


if __name__ == "__main__":
    main()
