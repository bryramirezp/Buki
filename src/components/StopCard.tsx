import type { TripPlace, TripStop } from '../types'
import { formatDistance, formatSnapshotTimestamp, KIND_LABELS, KIND_SYMBOLS } from '../plannerPresentation'

export interface StopCardProps {
  stop: TripStop
  isCurrent: boolean
  showWalking: boolean
  onRequestRepair: () => void
  isRepairing: boolean
  repairDisabled: boolean
}

export function StopCard({ stop, isCurrent, showWalking, onRequestRepair, isRepairing, repairDisabled }: StopCardProps) {
  const place: TripPlace = stop.place
  const isClosed = place.availability === 'closed'

  return (
    <div className="stop-group">
      {showWalking && (
        <div className="walking-connector">
          <span className="connector-line" />
          <span><strong>{stop.walkFromPrevious.minutes} min</strong> · {formatDistance(stop.walkFromPrevious.meters)} walking</span>
        </div>
      )}
      <article className={`stop-card ${isCurrent ? 'is-current' : ''} ${isClosed ? 'is-closed' : ''}`}>
        <div className="stop-number">{stop.sequence.toString().padStart(2, '0')}</div>
        <div className="stop-card-body">
          <div className="stop-card-topline">
            <span className="stop-kind">{KIND_SYMBOLS[place.kind]} {KIND_LABELS[place.kind]}</span>
            <span className={`availability availability-${place.availability}`}>{place.availabilityLabel}</span>
          </div>
          <h3>{place.name}</h3>
          <p>{place.summary}</p>
          <div className="stop-card-details">
            <span>{place.address}</span>
            <span>{formatSnapshotTimestamp(place.checkedAt)}</span>
          </div>
          {place.mapsUrl && <a className="maps-link" href={place.mapsUrl} target="_blank" rel="noreferrer">View on Google Maps ↗</a>}
          <button className="repair-stop-button" type="button" onClick={onRequestRepair} disabled={repairDisabled}>
            {isRepairing ? 'Finding an alternative…' : isClosed ? 'Find a real replacement' : 'Find an alternative'}
            <span aria-hidden="true">→</span>
          </button>
          {isClosed && <p className="availability-note">Buki will search real nearby places that keep your route constraints.</p>}
        </div>
      </article>
    </div>
  )
}
