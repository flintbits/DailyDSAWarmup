import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  FaBars,
  FaBookmark,
  FaCheck,
  FaChevronRight,
  FaCodeBranch,
  FaDownload,
  FaExternalLinkAlt,
  FaFilter,
  FaRandom,
  FaRedoAlt,
  FaTrashAlt,
  FaUpload,
} from 'react-icons/fa'
import './App.css'
import {
  allSubtopics,
  getCategoryStatus,
  getCompletionPercent,
  patternCategories,
  problemStats,
  type DsaCategory,
  type DsaSubtopic,
  type FilterMode,
  type SortMode,
} from './data/patterns'
import {
  DEFAULT_SETTINGS,
  clearAllProgress,
  readBookmark,
  readNote,
  readProgressRecord,
  readSettings,
  writeBookmark,
  writeMeta,
  writeNote,
  writeProgressRecord,
  writeSettings,
} from './lib/storage'

type NavView = 'all' | 'in-progress' | 'completed' | 'bookmarked'
type ConfirmAction =
  | { type: 'category-clear'; categoryId: string }
  | { type: 'global-clear' }
  | { type: 'global-complete' }
  | { type: 'reset' }
  | null

const categoryFilterOptions: FilterMode[] = ['all', 'incomplete', 'completed', 'bookmarked']

const buildCompletedMap = (): Record<string, boolean> => {
  const map: Record<string, boolean> = {}

  for (const subtopic of allSubtopics) {
    map[subtopic.id] = readProgressRecord(subtopic.id).done
  }

  return map
}

const buildBookmarkMap = (): Record<string, boolean> => {
  const map: Record<string, boolean> = {}

  for (const subtopic of allSubtopics) {
    map[subtopic.id] = readBookmark(subtopic.id)
  }

  return map
}

const buildNotesMap = (): Record<string, string> => {
  const map: Record<string, string> = {}

  for (const subtopic of allSubtopics) {
    const note = readNote(subtopic.id)
    if (note.trim()) {
      map[subtopic.id] = note
    }
  }

  return map
}

function App() {
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(() => buildCompletedMap())
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>(() => buildBookmarkMap())
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => buildNotesMap())
  const [navView, setNavView] = useState<NavView>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FilterMode>(() => readSettings().filterMode ?? DEFAULT_SETTINGS.filterMode)
  const [sortMode, setSortMode] = useState<SortMode>(() => readSettings().sortMode ?? DEFAULT_SETTINGS.sortMode)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [message, setMessage] = useState<string>('')
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const globalCheckboxRef = useRef<HTMLInputElement | null>(null)

  const totalSubtopics = allSubtopics.length
  const completedCount = allSubtopics.filter((subtopic) => completedMap[subtopic.id]).length
  const totalCategories = patternCategories.length
  const overallCompletion = getCompletionPercent(totalSubtopics, completedCount)
  const bookmarkedCount = allSubtopics.filter((subtopic) => bookmarkMap[subtopic.id]).length

  const allComplete = totalSubtopics > 0 && completedCount === totalSubtopics
  const someComplete = completedCount > 0 && completedCount < totalSubtopics

  useEffect(() => {
    if (globalCheckboxRef.current) {
      globalCheckboxRef.current.indeterminate = !allComplete && someComplete
    }
  }, [allComplete, someComplete])

  useEffect(() => {
    writeSettings({
      sortMode,
      filterMode: categoryFilter,
    })
  }, [sortMode, categoryFilter])

  useEffect(() => {
    writeMeta(new Date().toISOString())
  }, [completedMap, bookmarkMap, notesMap])

  const categorySummary = useMemo(
    () =>
      patternCategories.map((category) => {
        const completed = category.subtopics.filter((subtopic) => completedMap[subtopic.id]).length
        const total = category.subtopics.length
        const status = getCategoryStatus(category, new Set(Object.keys(completedMap).filter((id) => completedMap[id])))

        return {
          category,
          completed,
          total,
          percentage: getCompletionPercent(total, completed),
          status,
        }
      }),
    [completedMap],
  )

  const navCategoryList = useMemo(
    () =>
      patternCategories.filter((category) => {
        const done = category.subtopics.filter((subtopic) => completedMap[subtopic.id]).length
        const total = category.subtopics.length

        if (navView === 'all') {
          return true
        }

        if (navView === 'in-progress') {
          return done > 0 && done < total
        }

        if (navView === 'completed') {
          return done === total && total > 0
        }

        return category.subtopics.some((subtopic) => bookmarkMap[subtopic.id])
      }),
    [bookmarkMap, completedMap, navView],
  )

  const remainingSubtopic = useMemo(
    () =>
      allSubtopics.find((subtopic) => !completedMap[subtopic.id]) ||
      allSubtopics[0],
    [completedMap],
  )

  const recentlyCompleted = useMemo(
    () =>
      allSubtopics
        .filter((subtopic) => completedMap[subtopic.id])
        .slice(-3)
        .reverse(),
    [completedMap],
  )

  // For accordion: filter subtopics per category based on search/filter/sort
  const getFilteredSubtopics = (category: DsaCategory): DsaSubtopic[] => {
    const lowerQuery = searchQuery.trim().toLowerCase()

    const filtered = category.subtopics.filter((subtopic) => {
      const matchesSearch =
        !lowerQuery ||
        [subtopic.name, subtopic.problem.title, subtopic.categoryName, subtopic.problem.slug]
          .join(' ')
          .toLowerCase()
          .includes(lowerQuery)

      const matchesFilter = (() => {
        if (categoryFilter === 'all') {
          return true
        }

        if (categoryFilter === 'incomplete') {
          return !completedMap[subtopic.id]
        }

        if (categoryFilter === 'completed') {
          return completedMap[subtopic.id]
        }

        return bookmarkMap[subtopic.id]
      })()

      return matchesSearch && matchesFilter
    })

    if (sortMode === 'alphabetical') {
      return [...filtered].sort((left, right) => left.name.localeCompare(right.name))
    }

    return [...filtered].sort((left, right) => {
      const leftDone = completedMap[left.id] ? 1 : 0
      const rightDone = completedMap[right.id] ? 1 : 0

      if (leftDone !== rightDone) {
        return leftDone - rightDone
      }

      return left.name.localeCompare(right.name)
    })
  }

  // Visible categories for accordion (based on navView filter)
  const visibleCategories = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase()

    return categorySummary.filter(({ category, status }) => {
      // Nav view filter
      if (navView === 'in-progress' && status !== 'in-progress') return false
      if (navView === 'completed' && status !== 'completed') return false
      if (navView === 'bookmarked' && !category.subtopics.some((s) => bookmarkMap[s.id])) return false

      // Search filter — show categories that have any matching subtopics
      if (lowerQuery) {
        const hasMatch = category.subtopics.some((subtopic) =>
          [subtopic.name, subtopic.problem.title, subtopic.categoryName, subtopic.problem.slug]
            .join(' ')
            .toLowerCase()
            .includes(lowerQuery),
        )
        if (!hasMatch) return false
      }

      // Category filter — show categories that have subtopics matching the filter
      if (categoryFilter !== 'all') {
        const hasMatch = category.subtopics.some((subtopic) => {
          if (categoryFilter === 'incomplete') return !completedMap[subtopic.id]
          if (categoryFilter === 'completed') return completedMap[subtopic.id]
          return bookmarkMap[subtopic.id]
        })
        if (!hasMatch) return false
      }

      return true
    })
  }, [categorySummary, navView, searchQuery, categoryFilter, completedMap, bookmarkMap])

  const updateCompleted = (subtopicId: string, nextState: boolean) => {
    const next = { ...completedMap, [subtopicId]: nextState }
    setCompletedMap(next)
    writeProgressRecord(subtopicId, nextState)
  }

  const toggleBookmark = (subtopicId: string) => {
    const nextState = !bookmarkMap[subtopicId]
    setBookmarkMap((current) => ({ ...current, [subtopicId]: nextState }))
    writeBookmark(subtopicId, nextState)
  }

  const updateNote = (subtopicId: string, note: string) => {
    setNotesMap((current) => {
      const next = { ...current }
      if (note.trim()) {
        next[subtopicId] = note
      } else {
        delete next[subtopicId]
      }

      return next
    })
    writeNote(subtopicId, note)
  }

  const setCategoryCompletion = (category: DsaCategory, isComplete: boolean) => {
    const next = { ...completedMap }

    for (const subtopic of category.subtopics) {
      next[subtopic.id] = isComplete
      writeProgressRecord(subtopic.id, isComplete)
    }

    setCompletedMap(next)
  }

  const handleGlobalCompletion = (nextState: boolean) => {
    const next = { ...completedMap }

    for (const subtopic of allSubtopics) {
      next[subtopic.id] = nextState
      writeProgressRecord(subtopic.id, nextState)
    }

    setCompletedMap(next)
  }

  const clearCategoryProgress = (category: DsaCategory) => {
    const next = { ...completedMap }

    for (const subtopic of category.subtopics) {
      next[subtopic.id] = false
      writeProgressRecord(subtopic.id, false)
    }

    setCompletedMap(next)
  }

  const clearAllStoredProgress = () => {
    clearAllProgress()
    setCompletedMap(buildCompletedMap())
    setBookmarkMap(buildBookmarkMap())
    setNotesMap(buildNotesMap())
    setMessage('Progress reset successfully.')
  }

  const pickRandomSubtopic = () => {
    const unfinished = allSubtopics.filter((subtopic) => !completedMap[subtopic.id])

    if (unfinished.length === 0) {
      setMessage('Everything is already complete.')
      return
    }

    const choice = unfinished[Math.floor(Math.random() * unfinished.length)]
    setExpandedCategoryId(choice.categoryId)
    setNavView('all')
    setSearchQuery('')
    setMessage(`Random pick: ${choice.name}`)
  }

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: allSubtopics.map((subtopic) => ({
        id: subtopic.id,
        completed: Boolean(completedMap[subtopic.id]),
        bookmarked: Boolean(bookmarkMap[subtopic.id]),
        note: notesMap[subtopic.id] ?? '',
      })),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'dsa-tracker-progress.json'
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage('Progress exported as JSON.')
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)

      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.progress)) {
        throw new Error('Invalid data format.')
      }

      const validIds = new Set(allSubtopics.map((subtopic) => subtopic.id))
      const nextCompleted: Record<string, boolean> = { ...completedMap }
      const nextBookmarks: Record<string, boolean> = { ...bookmarkMap }
      const nextNotes: Record<string, string> = { ...notesMap }

      for (const entry of parsed.progress) {
        if (!entry || typeof entry.id !== 'string' || !validIds.has(entry.id)) {
          continue
        }

        const completed = Boolean(entry.completed)
        const bookmarked = Boolean(entry.bookmarked)
        const note = typeof entry.note === 'string' ? entry.note : ''

        nextCompleted[entry.id] = completed
        nextBookmarks[entry.id] = bookmarked

        if (note.trim()) {
          nextNotes[entry.id] = note
        } else {
          delete nextNotes[entry.id]
        }

        writeProgressRecord(entry.id, completed)
        writeBookmark(entry.id, bookmarked)
        writeNote(entry.id, note)
      }

      setCompletedMap(nextCompleted)
      setBookmarkMap(nextBookmarks)
      setNotesMap(nextNotes)
      setMessage(`Imported ${parsed.progress.length} tracked entries.`)
    } catch {
      setMessage('Import failed: please choose a valid exported JSON file.')
    }

    event.target.value = ''
  }

  const handleConfirm = () => {
    if (!confirmAction) {
      return
    }

    if (confirmAction.type === 'category-clear') {
      const category = patternCategories.find((item) => item.id === confirmAction.categoryId)
      if (category) {
        clearCategoryProgress(category)
      }
    }

    if (confirmAction.type === 'global-clear') {
      handleGlobalCompletion(false)
    }

    if (confirmAction.type === 'global-complete') {
      handleGlobalCompletion(true)
    }

    if (confirmAction.type === 'reset') {
      clearAllStoredProgress()
    }

    setConfirmAction(null)
  }

  const toggleSidebar = () => setMobileNavOpen((current) => !current)

  const toggleAccordion = (categoryId: string) => {
    setExpandedCategoryId((current) => (current === categoryId ? null : categoryId))
  }

  const handleSidebarCategoryClick = (categoryId: string) => {
    setExpandedCategoryId(categoryId)
    setMobileNavOpen(false)
    // Scroll to the accordion item
    setTimeout(() => {
      const el = document.getElementById(`accordion-${categoryId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">
            <FaCodeBranch aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Practice tracker</p>
            <h2>DSA Tracker</h2>
          </div>
        </div>

        <div className="summary-panel">
          <div className="summary-row">
            <span>Overall</span>
            <strong>{overallCompletion}%</strong>
          </div>
          <div className="progress-track small">
            <span style={{ width: `${overallCompletion}%` }} />
          </div>
          <div className="summary-meta">
            {completedCount}/{totalSubtopics} done
          </div>
        </div>

        <nav className="nav-group" aria-label="Progress navigation">
          {(['all', 'in-progress', 'completed', 'bookmarked'] as const).map((view) => (
            <button
              key={view}
              type="button"
              className={`nav-button ${navView === view ? 'active' : ''}`}
              onClick={() => {
                setNavView(view)
                setMobileNavOpen(false)
              }}
            >
              <span>{view === 'all' ? 'All Patterns' : view === 'in-progress' ? 'In Progress' : view === 'completed' ? 'Completed' : 'Bookmarked'}</span>
              <span className="nav-count">
                {view === 'all'
                  ? totalCategories
                  : view === 'in-progress'
                    ? categorySummary.filter((item) => item.status === 'in-progress').length
                    : view === 'completed'
                      ? categorySummary.filter((item) => item.status === 'completed').length
                      : bookmarkedCount}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-section">
          <p className="section-label">Patterns</p>
          <div className="category-list">
            {navCategoryList.map((category) => {
              const done = category.subtopics.filter((subtopic) => completedMap[subtopic.id]).length
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`category-link ${expandedCategoryId === category.id ? 'selected' : ''}`}
                  onClick={() => handleSidebarCategoryClick(category.id)}
                >
                  <span>{category.name}</span>
                  <small>
                    {done}/{category.subtopics.length}
                  </small>
                </button>
              )
            })}
          </div>
        </div>

        <div className="sidebar-section settings">
          <p className="section-label">Data</p>
          <button type="button" className="data-button" onClick={handleExport}>
            <FaDownload /> Export
          </button>
          <label className="data-button import-button" htmlFor="progress-import">
            <FaUpload /> Import
          </label>
          <input id="progress-import" type="file" accept="application/json" onChange={handleImport} hidden />
          <button
            type="button"
            className="data-button danger"
            onClick={() => setConfirmAction({ type: 'reset' })}
          >
            <FaTrashAlt /> Reset
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <div className="main-content">
          <header className="topbar">
            <div className="mobile-header">
              <button type="button" className="mobile-toggle" onClick={toggleSidebar} aria-label="Toggle menu">
                <FaBars />
              </button>
              <div className="topbar-meta">
                <p className="eyebrow">DSA practice</p>
                <h1>Progress tracker</h1>
              </div>
            </div>
            <div className="topbarActions">
              <div className="search-box">
                <FaFilter />
                <input
                  aria-label="Search patterns and questions"
                  value={searchQuery}
                  placeholder="Search category, subtopic, or problem"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <button type="button" className="primary-button" onClick={() => setConfirmAction({ type: 'global-complete' })}>
                <FaCheck /> Mark all complete
              </button>
            </div>
          </header>

          <div className="hero-card">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>Stay consistent, one subpattern at a time.</h2>
            </div>
            <div className="global-control">
              <label className="checkbox-label">
                <input
                  ref={globalCheckboxRef}
                  type="checkbox"
                  checked={allComplete}
                  onChange={(event) => {
                    const nextState = event.target.checked
                    setConfirmAction(nextState ? { type: 'global-complete' } : { type: 'global-clear' })
                  }}
                />
                <span>
                  {allComplete ? 'All complete' : someComplete ? 'In progress' : 'Not started'}
                </span>
              </label>
              <button type="button" className="ghost-button" onClick={() => setConfirmAction({ type: 'global-clear' })}>
                <FaRedoAlt /> Clear all
              </button>
            </div>
          </div>

          <section className="stats-grid">
            <article className="stat-card">
              <span className="stat-label">Completion</span>
              <strong>{overallCompletion}%</strong>
              <div className="progress-track">
                <span style={{ width: `${overallCompletion}%` }} />
              </div>
              <small>{completedCount} of {totalSubtopics} subtopics</small>
            </article>

            <article className="stat-card">
              <span className="stat-label">Patterns</span>
              <strong>{totalCategories}</strong>
              <small>30 tracked categories</small>
            </article>

            <article className="stat-card">
              <span className="stat-label">Completed</span>
              <strong>{categorySummary.filter((item) => item.status === 'completed').length}</strong>
              <small>Fully finished categories</small>
            </article>

            <article className="stat-card">
              <span className="stat-label">In progress</span>
              <strong>{categorySummary.filter((item) => item.status === 'in-progress').length}</strong>
              <small>Need another pass</small>
            </article>
          </section>

          {/* Filter bar above accordion */}
          <div className="filter-bar">
            <div className="filter-row">
              {categoryFilterOptions.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`chip ${categoryFilter === filter ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(filter)}
                >
                  {filter === 'all' ? 'All' : filter === 'incomplete' ? 'Incomplete' : filter === 'completed' ? 'Completed' : 'Bookmarked'}
                </button>
              ))}
            </div>

            <div className="sort-row">
              <label htmlFor="sort-patterns">Sort</label>
              <select
                id="sort-patterns"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="completion">Completion</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>
          </div>

          {/* Accordion pattern index */}
          <section className="accordion-section">
            <div className="accordion-section-heading">
              <h3>Pattern index</h3>
              <p>{problemStats.uniqueProblemCount} unique LeetCode problems</p>
            </div>

            {visibleCategories.length > 0 ? (
              visibleCategories.map(({ category, completed, total, percentage }, index) => {
                const isExpanded = expandedCategoryId === category.id
                const filteredSubtopics = getFilteredSubtopics(category)
                const categoryAllDone = total > 0 && completed === total

                return (
                  <div key={category.id} className="accordion-item" id={`accordion-${category.id}`}>
                    <button
                      type="button"
                      className="accordion-header"
                      aria-expanded={isExpanded}
                      aria-controls={`accordion-body-${category.id}`}
                      onClick={() => toggleAccordion(category.id)}
                    >
                      <span className="accordion-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="accordion-name">{category.name}</span>
                      <span className="accordion-count">
                        {completed} / {total}
                      </span>
                      <span className="accordion-percent">{percentage}%</span>
                      <span className="accordion-bar">
                        <span style={{ width: `${percentage}%` }} />
                      </span>
                      <FaChevronRight className={`accordion-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="accordion-body" id={`accordion-body-${category.id}`} role="region">
                        <div className="accordion-body-controls">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={categoryAllDone}
                              onChange={(event) => {
                                setCategoryCompletion(category, event.target.checked)
                              }}
                            />
                            <span>Mark all complete</span>
                          </label>
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() => setConfirmAction({ type: 'category-clear', categoryId: category.id })}
                          >
                            Clear
                          </button>
                        </div>

                        <div className="subtopic-list" role="list">
                          {filteredSubtopics.length > 0 ? (
                            filteredSubtopics.map((subtopic) => (
                              <div key={subtopic.id} className="subtopic-row" role="listitem">
                                <label className="checkbox-label row-check">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(completedMap[subtopic.id])}
                                    onChange={(event) => updateCompleted(subtopic.id, event.target.checked)}
                                  />
                                </label>

                                <div className="subtopic-copy">
                                  <div className="subtopic-title-row">
                                    <span className="subtopic-name">{subtopic.name}</span>
                                  </div>

                                  <div className="problem-row">
                                    <a
                                      href={subtopic.problem.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                      className="problem-link"
                                    >
                                      {subtopic.problem.title}
                                      <FaExternalLinkAlt />
                                    </a>
                                  </div>

                                  {(editingNoteId === subtopic.id || (notesMap[subtopic.id] && notesMap[subtopic.id].trim())) && (
                                    <div className="notes-block">
                                      <textarea
                                        id={`note-${subtopic.id}`}
                                        value={notesMap[subtopic.id] ?? ''}
                                        rows={1}
                                        placeholder="Add a note…"
                                        onChange={(event) => updateNote(subtopic.id, event.target.value)}
                                        onBlur={() => setEditingNoteId(null)}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="subtopic-actions">
                                  {editingNoteId !== subtopic.id && !notesMap[subtopic.id]?.trim() && (
                                    <button
                                      type="button"
                                      className="note-toggle"
                                      onClick={() => setEditingNoteId(subtopic.id)}
                                      aria-label="Add note"
                                      title="Add note"
                                    >
                                      +Note
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={`bookmark-button ${bookmarkMap[subtopic.id] ? 'active' : ''}`}
                                    onClick={() => toggleBookmark(subtopic.id)}
                                    aria-label={bookmarkMap[subtopic.id] ? 'Remove bookmark' : 'Bookmark subtopic'}
                                  >
                                    <FaBookmark />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state-panel">
                              <p>No matches found for this filter.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="empty-state-panel">
                <p>No patterns match the current filter.</p>
              </div>
            )}
          </section>

          {/* Continue practicing + Recently completed */}
          <section className="secondary-grid">
            <article className="mini-panel">
              <div className="section-heading compact">
                <h3>Continue practicing</h3>
              </div>
              {remainingSubtopic ? (
                <>
                  <button
                    type="button"
                    className="continue-panel"
                    onClick={() => {
                      setExpandedCategoryId(remainingSubtopic.categoryId)
                      setNavView('all')
                      setTimeout(() => {
                        const el = document.getElementById(`accordion-${remainingSubtopic.categoryId}`)
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }, 50)
                    }}
                  >
                    <div>
                      <p className="eyebrow">Next up</p>
                      <strong>{remainingSubtopic.name}</strong>
                    </div>
                    <FaChevronRight />
                  </button>
                  <button type="button" className="ghost-button random-button" onClick={pickRandomSubtopic}>
                    <FaRandom /> Pick random unfinished
                  </button>
                </>
              ) : (
                <p className="empty-state">Everything is complete — excellent work.</p>
              )}
            </article>

            <article className="mini-panel">
              <div className="section-heading compact">
                <h3>Recently completed</h3>
              </div>
              <ul className="recent-list">
                {recentlyCompleted.length > 0 ? (
                  recentlyCompleted.map((subtopic) => (
                    <li key={subtopic.id}>
                      <span>{subtopic.name}</span>
                      <FaCheck />
                    </li>
                  ))
                ) : (
                  <li className="empty-state">No completions yet.</li>
                )}
              </ul>
            </article>
          </section>

          {message && <div className="status-message">{message}</div>}
        </div>
      </main>

      {confirmAction && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <h4>Confirm action</h4>
            <p>
              {confirmAction.type === 'category-clear'
                ? 'This will clear all completion states for this category.'
                : confirmAction.type === 'global-clear'
                  ? 'This will clear all progress across the full tracker.'
                  : confirmAction.type === 'global-complete'
                    ? 'This will mark every subtopic as complete.'
                    : 'This will remove all saved progress and bookmarks.'}
            </p>
            <div className="dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
