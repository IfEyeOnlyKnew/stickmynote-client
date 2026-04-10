"use client"

import { VideoTabContentBase, type VideoTabContentBaseProps } from "@/components/shared/VideoTabContentBase"

export type StickVideoTabContentProps = VideoTabContentBaseProps

export function StickVideoTabContent(props: Readonly<StickVideoTabContentProps>) {
  return <VideoTabContentBase {...props} />
}
