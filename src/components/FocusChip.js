'use client';
// Shown above a list that a notification narrowed to one record — says so, and
// gives the way back to the whole list.
import Icon from './Icon';

export default function FocusChip({ what = 'record', found = true, onClear }) {
  return (
    <div className={`focus-chip${found ? '' : ' is-missing'}`}>
      <Icon name="bell" size={14} />
      <span>{found ? `Showing the ${what} from your notification` : `That ${what} is not in this list any more`}</span>
      <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={onClear}>Show all</button>
    </div>
  );
}
