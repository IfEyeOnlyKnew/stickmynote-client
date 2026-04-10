"use client"

import { VideoTabContentBase, type VideoTabContentBaseProps } from "@/components/shared/VideoTabContentBase"

export type VideoTabContentProps = VideoTabContentBaseProps

export function VideoTabContent(props: Readonly<VideoTabContentProps>) {
  return <VideoTabContentBase {...props} />
}
