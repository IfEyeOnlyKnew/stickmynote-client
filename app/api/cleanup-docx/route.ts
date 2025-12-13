import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import fs from "fs"
import { promisify } from "util"

let put: any, del: any

const initializeModules = async () => {
  try {
    const blobModule = await import("@vercel/blob")
    put = blobModule.put
    del = blobModule.del
  } catch (error) {
    put = async () => ({ url: "" })
    del = async () => ({})
  }
}

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

export async function POST(request: NextRequest) {
  await initializeModules()

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
    await writeFile(inputPath, Buffer.from(buffer))

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

    const cleanedBlobResult = await put(filename, cleanedBlob, {
      access: "public",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    // Clean up temporary files
    try {
      await unlink(inputPath)
      await unlink(outputPath)
    } catch (cleanupError) {}

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
