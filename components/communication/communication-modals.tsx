"use client"

import { useState } from "react"
import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCommunicationPaletteContext } from "./communication-palette-provider"
import { CommunicationPalette } from "./communication-palette"
import { QuickCallModal, ScreenShareModal } from "./quick-call-modal"
import { ScheduleMeetingModal } from "./schedule-meeting-modal"
import { FullCalendarModal } from "./full-calendar-modal"
import { MeetingNotesModal } from "./meeting-notes-modal"
import { SchedulingAssistant } from "./scheduling-assistant"

/**
 * CommunicationModals - Renders the communication palette, FAB trigger, and all associated modals
 *
 * This component should be placed inside a CommunicationPaletteProvider.
 * It handles rendering the correct modal based on the activeModal state.
 * Includes a Floating Action Button (FAB) to open the palette.
 *
 * Usage:
 * ```tsx
 * <CommunicationPaletteProvider context={{ padId: "...", padName: "..." }}>
 *   <YourPageContent />
 *   <CommunicationModals />
 * </CommunicationPaletteProvider>
 * ```
 */
export function CommunicationModals() {
  const {
    activeModal,
    closeModal,
    openModal,
    openPalette,
  } = useCommunicationPaletteContext()

  // Track selected date from calendar for scheduling
  const [schedulingDate, setSchedulingDate] = useState<Date | undefined>(undefined)
  const [schedulingParticipants, setSchedulingParticipants] = useState<string[]>([])

  // Handle switching from calendar to schedule meeting
  const handleScheduleFromCalendar = (selectedDate?: Date) => {
    setSchedulingDate(selectedDate)
    closeModal()
    // Small delay to allow the calendar modal to close
    setTimeout(() => {
      openModal("schedule-meeting")
    }, 100)
  }

  // Handle scheduling from the assistant
  const handleScheduleFromAssistant = (slot: {
    date: Date
    startTime: Date
    endTime: Date
    participants: string[]
  }) => {
    setSchedulingDate(slot.startTime)
    setSchedulingParticipants(slot.participants)
    closeModal()
    setTimeout(() => {
      openModal("schedule-meeting")
    }, 100)
  }

  // Clear scheduling date and participants when schedule modal closes
  const handleScheduleModalClose = (open: boolean) => {
    if (!open) {
      closeModal()
      setSchedulingDate(undefined)
      setSchedulingParticipants([])
    }
  }

  return (
    <>
      {/* Floating Action Button (FAB) - Communication Trigger */}
      <Button
        onClick={openPalette}
        className="fixed bottom-[104px] right-4 sm:right-6 z-[9996] w-10 h-10 sm:w-14 sm:h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-0"
        title="Open communication palette"
        aria-label="Open communication palette"
      >
        <Phone className="h-4 w-4 sm:h-6 sm:w-6" />
      </Button>

      {/* Main Palette */}
      <CommunicationPalette />

      {/* Quick Call Modal */}
      <QuickCallModal
        open={activeModal === "quick-call"}
        onOpenChange={(open) => !open && closeModal()}
      />

      {/* Screen Share Modal */}
      <ScreenShareModal
        open={activeModal === "screen-share"}
        onOpenChange={(open) => !open && closeModal()}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        open={activeModal === "schedule-meeting"}
        onOpenChange={handleScheduleModalClose}
        defaultDate={schedulingDate}
        defaultParticipants={schedulingParticipants}
      />

      {/* Full Calendar Modal */}
      <FullCalendarModal
        open={activeModal === "calendar-view"}
        onOpenChange={(open) => !open && closeModal()}
        onScheduleMeeting={handleScheduleFromCalendar}
      />

      {/* Meeting Notes Modal */}
      <MeetingNotesModal
        open={activeModal === "meeting-notes"}
        onOpenChange={(open) => !open && closeModal()}
      />

      {/* Scheduling Assistant */}
      <SchedulingAssistant
        open={activeModal === "scheduling-assistant"}
        onOpenChange={(open) => !open && closeModal()}
        onSchedule={handleScheduleFromAssistant}
      />
    </>
  )
}
