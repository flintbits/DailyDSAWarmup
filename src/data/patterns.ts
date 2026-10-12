import patternMarkdown from '../assets/leetcode-question-per-subpattern.md?raw'

export type FilterMode = 'all' | 'incomplete' | 'completed' | 'bookmarked'
export type SortMode = 'alphabetical' | 'completion'
export type CategoryStatus = 'not-started' | 'in-progress' | 'completed'

export interface DsaProblem {
  id: string
  title: string
  slug: string
  url: string
}

export interface DsaSubtopic {
  id: string
  categoryId: string
  categoryName: string
  name: string
  problem: DsaProblem
}

export interface DsaCategory {
  id: string
  name: string
  subtopics: DsaSubtopic[]
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item'

const normalize = (value: string): string => value.replace(/\u00a0/g, ' ').trim()

const extractProblemSlug = (url: string): string => {
  const match = url.match(/\/problems\/([^/]+)/)
  return match ? match[1].replace(/\/$/, '') : slugify(url)
}

const parsePatternMarkdown = (markdown: string): DsaCategory[] => {
  const categories: DsaCategory[] = []
  let currentCategory: DsaCategory | null = null

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line) {
      continue
    }

    if (line.startsWith('## ')) {
      if (currentCategory) {
        categories.push(currentCategory)
      }

      const categoryName = normalize(line.replace(/^##\s+/, ''))
      currentCategory = {
        id: slugify(categoryName),
        name: categoryName,
        subtopics: [],
      }
      continue
    }

    if (!currentCategory) {
      continue
    }

    const match = line.match(
      /^- \[[ xX]\]\s+\*\*(.+?)\*\*\s*—\s*\[([^\]]+)\]\((https?:\/\/leetcode\.com\/problems\/[^)]+)\)/,
    )

    if (!match) {
      continue
    }

    const [, subtopicName, problemTitle, problemUrl] = match
    const problemSlug = extractProblemSlug(problemUrl)

    currentCategory.subtopics.push({
      id: `${currentCategory.id}-${slugify(subtopicName)}`,
      categoryId: currentCategory.id,
      categoryName: currentCategory.name,
      name: normalize(subtopicName),
      problem: {
        id: problemSlug,
        title: normalize(problemTitle),
        slug: problemSlug,
        url: problemUrl,
      },
    })
  }

  if (currentCategory) {
    categories.push(currentCategory)
  }

  return categories
}

export const patternCategories = parsePatternMarkdown(patternMarkdown)

export const allSubtopics = patternCategories.flatMap((category) =>
  category.subtopics.map((subtopic) => ({
    ...subtopic,
    category,
  })),
)

export const problemStats = (() => {
  const uniqueProblems = new Set(allSubtopics.map((subtopic) => subtopic.problem.slug))
  return {
    categoryCount: patternCategories.length,
    subtopicCount: allSubtopics.length,
    uniqueProblemCount: uniqueProblems.size,
  }
})()

export const getCategoryStatus = (category: DsaCategory, completedIds: Set<string>): CategoryStatus => {
  const total = category.subtopics.length
  if (total === 0) {
    return 'not-started'
  }

  const completedCount = category.subtopics.filter((subtopic) => completedIds.has(subtopic.id)).length

  if (completedCount === 0) {
    return 'not-started'
  }

  if (completedCount === total) {
    return 'completed'
  }

  return 'in-progress'
}

export const getCompletionPercent = (total: number, completed: number): number => {
  if (total === 0) {
    return 0
  }

  return Math.round((completed / total) * 100)
}
