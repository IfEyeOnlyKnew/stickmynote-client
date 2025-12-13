"use client"

import { useState, useEffect, useCallback, useMemo } from "react"

interface UsePaginationProps {
  totalItems: number
  itemsPerPage: number
  enableInfiniteScroll?: boolean
}

interface UsePaginationReturn {
  currentPage: number
  loadedPages: number
  totalPages: number
  hasMorePages: boolean
  displayedItemsCount: number
  setCurrentPage: (page: number) => void
  loadMorePages: (additionalPages?: number) => void
  handleScroll: () => void
  resetPagination: () => void
}

export function usePagination({
  totalItems,
  itemsPerPage,
  enableInfiniteScroll = true,
}: UsePaginationProps): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1)
  const [loadedPages, setLoadedPages] = useState(1)

  const totalPages = useMemo(() => Math.ceil(totalItems / itemsPerPage), [totalItems, itemsPerPage])
  const hasMorePages = useMemo(() => loadedPages < totalPages, [loadedPages, totalPages])
  const displayedItemsCount = useMemo(
    () => Math.min(loadedPages * itemsPerPage, totalItems),
    [loadedPages, itemsPerPage, totalItems],
  )

  const loadMorePages = useCallback(
    (additionalPages = 1) => {
      setLoadedPages((prev) => Math.min(prev + additionalPages, totalPages))
    },
    [totalPages],
  )

  const handleScroll = useCallback(() => {
    if (!enableInfiniteScroll || !hasMorePages) return

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when user scrolls to 80% of the page
    if (scrollPercentage > 0.8) {
      loadMorePages(1)
    }
  }, [enableInfiniteScroll, hasMorePages, loadMorePages])

  const resetPagination = useCallback(() => {
    setLoadedPages(1)
    setCurrentPage(1)
  }, [])

  // Reset pagination when total items change
  useEffect(() => {
    resetPagination()
  }, [totalItems, resetPagination])

  // Set up scroll listener
  useEffect(() => {
    if (!enableInfiniteScroll) return

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll, enableInfiniteScroll])

  return {
    currentPage,
    loadedPages,
    totalPages,
    hasMorePages,
    displayedItemsCount,
    setCurrentPage,
    loadMorePages,
    handleScroll,
    resetPagination,
  }
}
