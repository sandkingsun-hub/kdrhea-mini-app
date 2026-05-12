import type { PetSkin, PetSpecies, PetState } from "~/types/pet";
import { View } from "@tarojs/components";
import { useEffect, useState } from "react";
import styles from "./PetSprite.module.css";

interface Props {
  species: PetSpecies;
  skin: PetSkin | null;
  state: PetState;
  onClick?: () => void;
}

export function PetSprite({ species, skin, state, onClick }: Props) {
  const [showZzz, setShowZzz] = useState(false);

  useEffect(() => {
    setShowZzz(state === "sleeping");
  }, [state]);

  const spriteUrl = skin?.spriteUrl || species.spriteUrl;
  const frame = species.frames[state];
  const { cols, rows } = species.spriteGrid;
  const { w: frameW, h: frameH } = species.spriteFrameSize;

  // 显示尺寸 192x208 rpx (96px × 2 倍放大)
  const displayW = 192;
  const displayH = 208;
  const ratio = displayW / frameW;
  const sheetW = frameW * cols * ratio;
  const sheetH = frameH * rows * ratio;
  const startX = -frame.col * frameW * ratio;
  const startY = -frame.row * frameH * ratio;
  const endX = startX - frame.count * frameW * ratio;

  const animName = `pet-${species._id}-${state}`;

  return (
    <View className={styles.container} onClick={onClick}>
      <View
        className={styles.sprite}
        style={{
          width: `${displayW}rpx`,
          height: `${displayH}rpx`,
          backgroundImage: `url(${spriteUrl})`,
          backgroundSize: `${sheetW}rpx ${sheetH}rpx`,
          backgroundPosition: `${startX}rpx ${startY}rpx`,
          animation: `${animName} ${frame.count / frame.fps}s steps(${frame.count}) infinite`,
        }}
      />
      <style>
        {`
        @keyframes ${animName} {
          from { background-position: ${startX}rpx ${startY}rpx; }
          to { background-position: ${endX}rpx ${startY}rpx; }
        }
      `}
      </style>
      {showZzz && <View className={styles.zzz}>z</View>}
    </View>
  );
}
