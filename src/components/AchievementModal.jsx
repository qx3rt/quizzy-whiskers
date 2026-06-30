import { getAchievementIcon } from '../utils/achievementIcons'

export default function AchievementModal({ achievements, index, onNext }) {
  if (!achievements.length || index >= achievements.length) return null

  const current = achievements[index]
  const total = achievements.length
  const isLast = index === total - 1

  return (
    <div className="achievement-modal-overlay">
      <div className="achievement-modal" key={index}>
        <p className="achievement-modal-label">Achievement Unlocked!</p>
        <div className="achievement-modal-icon">{getAchievementIcon(current.slug)}</div>
        <h2 className="achievement-modal-name">{current.name}</h2>
        <p className="achievement-modal-desc">{current.description}</p>
        {total > 1 && (
          <p className="achievement-modal-counter">{index + 1} of {total}</p>
        )}
        <button className="achievement-modal-btn" onClick={onNext}>
          {isLast ? current.phrase : 'Next →'}
        </button>
      </div>
    </div>
  )
}
