"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Clock, User } from "lucide-react"
import { useRouter } from "next/navigation"

interface InferenceStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  created_at: string
  color: string
  social_pads?: {
    id: string
    name: string
  }
  users?: {
    full_name: string
    email: string
  }
}

interface SticksTableViewProps {
  sticks: InferenceStick[]
  groupByPad?: boolean
}

export function SticksTableView({ sticks, groupByPad = false }: Readonly<SticksTableViewProps>) {
  const router = useRouter()

  if (sticks.length === 0) {
    return (
      <Card className="border-2 border-dashed border-purple-200 bg-white/50 backdrop-blur-sm">
        <CardContent className="py-16 text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">No Sticks Found</h3>
          <p className="text-gray-500">There are no sticks to display in this view.</p>
        </CardContent>
      </Card>
    )
  }

  // Group sticks by pad if needed
  const groupedSticks = groupByPad
    ? sticks.reduce(
        (acc, stick) => {
          const padName = stick.social_pads?.name || "Unknown Pad"
          if (!acc[padName]) {
            acc[padName] = []
          }
          acc[padName].push(stick)
          return acc
        },
        {} as Record<string, InferenceStick[]>,
      )
    : { "All Sticks": sticks }

  return (
    <div className="space-y-6">
      {Object.entries(groupedSticks).map(([padName, padSticks]) => (
        <Card key={padName} className="border-0 shadow-xl overflow-hidden bg-white">
          {groupByPad && (
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
              <h3 className="text-xl font-bold">{padName}</h3>
              <p className="text-purple-100 text-sm mt-1">
                {padSticks.length} {padSticks.length === 1 ? "stick" : "sticks"}
              </p>
            </div>
          )}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-purple-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Topic</th>
                    {!groupByPad && <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pad</th>}
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-32">Replies</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 w-64">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {padSticks.map((stick, index) => (
                    <tr
                      key={stick.id}
                      onClick={() => router.push(`/inference/sticks/${stick.id}`)}
                      className={`cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ backgroundColor: stick.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 hover:text-purple-600 transition-colors line-clamp-1">
                              {stick.topic}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">{stick.content}</p>
                          </div>
                        </div>
                      </td>
                      {!groupByPad && (
                        <td className="px-6 py-4">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-0">
                            {stick.social_pads?.name || "Unknown"}
                          </Badge>
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <MessageCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">0</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {stick.users?.full_name || stick.users?.email || "Unknown User"}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(stick.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
