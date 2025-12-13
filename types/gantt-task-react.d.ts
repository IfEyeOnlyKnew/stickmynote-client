import type React from "react"
declare module "gantt-task-react" {
  export enum ViewMode {
    Hour = "Hour",
    QuarterDay = "Quarter Day",
    HalfDay = "Half Day",
    Day = "Day",
    Week = "Week",
    Month = "Month",
    Year = "Year",
  }

  export interface Task {
    id: string
    name: string
    start: Date
    end: Date
    progress: number
    type: "task" | "milestone" | "project"
    dependencies?: string[]
    styles?: {
      backgroundColor?: string
      backgroundSelectedColor?: string
      progressColor?: string
      progressSelectedColor?: string
    }
    isDisabled?: boolean
    project?: string
    hideChildren?: boolean
  }

  export interface GanttProps {
    tasks: Task[]
    viewMode?: ViewMode
    locale?: string
    rtl?: boolean
    headerHeight?: number
    columnWidth?: number
    listCellWidth?: string
    rowHeight?: number
    ganttHeight?: number
    barCornerRadius?: number
    barFill?: number
    barProgressColor?: string
    barProgressSelectedColor?: string
    barBackgroundColor?: string
    barBackgroundSelectedColor?: string
    projectProgressColor?: string
    projectProgressSelectedColor?: string
    projectBackgroundColor?: string
    projectBackgroundSelectedColor?: string
    milestoneBackgroundColor?: string
    milestoneBackgroundSelectedColor?: string
    fontSize?: string
    fontFamily?: string
    arrowColor?: string
    arrowIndent?: number
    todayColor?: string
    TooltipContent?: React.FC<{
      task: Task
      fontSize: string
      fontFamily: string
    }>
    TaskListHeader?: React.FC<{
      headerHeight: number
      rowWidth: string
      fontFamily: string
      fontSize: string
    }>
    TaskListTable?: React.FC<{
      rowHeight: number
      rowWidth: string
      fontFamily: string
      fontSize: string
      locale: string
      tasks: Task[]
      selectedTaskId: string
      setSelectedTask: (taskId: string) => void
      onExpanderClick: (task: Task) => void
    }>
    onDateChange?: (task: Task, children: Task[]) => void | boolean | Promise<void> | Promise<boolean>
    onProgressChange?: (task: Task, children: Task[]) => void | boolean | Promise<void> | Promise<boolean>
    onDoubleClick?: (task: Task) => void
    onClick?: (task: Task) => void
    onDelete?: (task: Task) => void | boolean | Promise<void> | Promise<boolean>
    onSelect?: (task: Task, isSelected: boolean) => void
    onExpanderClick?: (task: Task) => void
    timeStep?: number
  }

  export const Gantt: React.FC<GanttProps>
}
