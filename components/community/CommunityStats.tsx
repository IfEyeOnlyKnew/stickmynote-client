import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp, Heart } from "lucide-react"

export const CommunityStats = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
            1,234
          </div>
          <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +12% from last month
          </p>
        </CardContent>
      </Card>

      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Trending Notes</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200">
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
            89
          </div>
          <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +5 new today
          </p>
        </CardContent>
      </Card>

      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Total Likes</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-pink-100 to-red-200">
            <Heart className="h-5 w-5 text-red-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-red-500 bg-clip-text text-transparent">
            5,678
          </div>
          <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +23% this week
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
