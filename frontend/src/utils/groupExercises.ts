import { Exercise } from "../api/gym";

export interface ExerciseGroup {
  groupId: number;
  exercises: Exercise[];
  isSuperset: boolean;
}

export function groupExercises(exercises: Exercise[]): ExerciseGroup[] {
  const map = new Map<number, Exercise[]>();
  for (const ex of exercises) {
    const group = map.get(ex.superset_group);
    if (group) {
      group.push(ex);
    } else {
      map.set(ex.superset_group, [ex]);
    }
  }

  const groups: ExerciseGroup[] = [];
  for (const [groupId, exs] of map) {
    groups.push({ groupId, exercises: exs, isSuperset: exs.length >= 2 });
  }
  return groups;
}
