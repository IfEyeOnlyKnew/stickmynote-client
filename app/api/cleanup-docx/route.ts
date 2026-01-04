import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "node:child_process"
import path from "node:path"
import fs from "node:fs"
import { promisify } from "node:util"

import { put, del } from "@/lib/storage/local-storage"

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

export async function POST(request: NextRequest) {
  try {
    const { blobUrl, filename } = await request.json()

    if (!blobUrl || !filename) {
      return NextResponse.json({ error: "Missing blobUrl or filename" }, { status: 400 })
    }

    // Download the blob file
    const response = await fetch(blobUrl)
    if (!response.ok) {
      throw new Error(`Failed to download blob: ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()

    // Create temporary files
    const tempDir = "/tmp"
    const inputPath = path.join(tempDir, `input-${Date.now()}.docx`)
    const outputPath = path.join(tempDir, `output-${Date.now()}.docx`)

    // Write input file
    await writeFile(inputPath, new Uint8Array(buffer))

    // Run Python cleanup script
    const pythonProcess = spawn("python3", ["/app/scripts/cleanup-docx.py", inputPath, outputPath])

    const result = await new Promise<{ success: boolean; message: string }>((resolve) => {
      let stdout = ""
      let stderr = ""

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      pythonProcess.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, message: stdout.trim() })
        } else {
          resolve({ success: false, message: stderr.trim() || "Python script failed" })
        }
      })
    })

    if (!result.success) {
      throw new Error(`Cleanup failed: ${result.message}`)
    }

    // Read cleaned file
    const cleanedBuffer = await fs.promises.readFile(outputPath)

    // Upload cleaned file to blob storage
    const cleanedBlob = new Blob([new Uint8Array(cleanedBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    const cleanedBlobResult = await put(filename, Buffer.from(await cleanedBlob.arrayBuffer()), {
      folder: "documents",
    })

    // Clean up temporary files
    try {
      await unlink(inputPath)
      await unlink(outputPath)
    } catch (cleanupError) {
      console.warn("Failed to clean up temporary files:", cleanupError)
    }

    // Delete original blob
    await del(blobUrl)

    return NextResponse.json({
      success: true,
      cleanedUrl: cleanedBlobResult.url,
      message: "Document cleaned successfully",
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to clean document: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
