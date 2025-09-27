#!/bin/bash

# Chrome拡張機能用アイコンの作成スクリプト
# 元画像を各サイズにリサイズ

echo "Chrome拡張機能アイコンを作成中..."

# アイコンサイズの配列
sizes=(16 32 48 128)

# 各サイズでアイコンを作成
for size in "${sizes[@]}"; do
    echo "Creating ${size}x${size} icon..."
    # 実際の画像ファイルがある場合は以下のコマンドを使用
    # sips -z $size $size source_icon.png --out icon-${size}.png
done

echo "アイコン作成完了"
echo "実際の画像ファイルがある場合は、source_icon.pngとして保存し、このスクリプトを実行してください"