import type React from "react"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"
import type { SetupStepConfig } from "@/config/resend-setup-steps"

interface SetupStepProps {
  step: SetupStepConfig
  stepNumber: number
  children?: React.ReactNode
}

export function SetupStep({ step, stepNumber, children }: Readonly<SetupStepProps>) {
  const renderContent = (content: SetupStepConfig["content"][0]) => {
    switch (content.type) {
      case "text":
        return <p className="text-sm text-gray-600">{content.data}</p>

      case "code":
        return <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">{content.data}</div>

      case "list":
        return (
          <ol className="text-sm space-y-1 list-decimal list-inside text-gray-600">
            {content.data.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )

      case "settings":
        return (
          <div className="bg-gray-100 p-3 rounded-md text-sm space-y-1">
            {Object.entries(content.data).map(([key, value]) => (
              <div key={key}>
                <strong>{key}:</strong> {String(value)}
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Step {stepNumber}</Badge>
        <h3 className="font-semibold">{step.title}</h3>
      </div>
      <div className="pl-6 space-y-2">
        {step.description && <p className="text-sm text-gray-600">{step.description}</p>}

        {step.content?.map((content) => (
          <div key={`${content.type}-${content.data}`}>{renderContent(content)}</div>
        ))}

        {step.links && (
          <p className="text-xs text-gray-500">
            {step.links.map((link) => (
              <span key={link.url}>
                Get your API key from{" "}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {link.text} <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            ))}
          </p>
        )}

        {children}
      </div>
    </div>
  )
}
