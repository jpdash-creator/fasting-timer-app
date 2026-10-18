export const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄'] as const;
export const moodEmoji = (m: number | null) => (m ? MOOD_EMOJI[m - 1] : '');
