import { useEffect, useState } from 'react';
import { localDateString } from './ordersStore';

/** Today's date (YYYY-MM-DD, shop time); updates itself after midnight. */
export function useToday() {
  const [today, setToday] = useState(() => localDateString());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = localDateString();
      setToday((prev) => (prev === now ? prev : now));
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
