<script setup lang="ts">
import BaseSelect from '../../../components/base/BaseSelect.vue';
import type { SelectOption } from '../../../components/base/BaseSelect.vue';
import BaseBadge from '../../../components/base/BaseBadge.vue';
import type { ResolvedNode } from '../composables/useTournament';

const props = defineProps<{
  node: ResolvedNode;
  editable: boolean;
  teamOptions: SelectOption[];
  teamLabel: (id: string | null) => string;
}>();

const emit = defineEmits<{
  seed: [side: 'A' | 'B', teamId: string | null];
  winner: [side: 'A' | 'B'];
  openMatch: [matchId: string];
}>();

const toggleWinner = (side: 'A' | 'B') => {
  const teamId = side === 'A' ? props.node.teamAId : props.node.teamBId;
  if (teamId) emit('winner', side);
};
</script>

<template>
  <div class="bg-zinc-800 border border-border rounded-xl p-3 space-y-2">
    <div
      v-for="side in (['A', 'B'] as const)"
      :key="side"
      class="flex items-center gap-2 rounded-lg px-2 py-1.5"
      :class="
        node.winnerTeamId && node.winnerTeamId === (side === 'A' ? node.teamAId : node.teamBId)
          ? node.winnerIsManual
            ? 'bg-amber-500/10'
            : 'bg-emerald-500/10'
          : ''
      "
    >
      <template v-if="editable">
        <BaseSelect
          class="flex-1 min-w-0"
          :model-value="(side === 'A' ? node.teamAId : node.teamBId) ?? undefined"
          :options="teamOptions"
          placeholder="TBD"
          size="sm"
          clearable
          @update:model-value="(v) => emit('seed', side, (v as string) ?? null)"
        />
      </template>
      <span
        v-else
        class="flex-1 min-w-0 truncate text-sm"
        :class="(side === 'A' ? node.teamAId : node.teamBId) ? 'text-text-main' : 'text-zinc-500 italic'"
      >
        {{ teamLabel(side === 'A' ? node.teamAId : node.teamBId) }}
      </span>
      <span v-if="node.match" class="text-sm font-bold text-zinc-300 shrink-0 w-5 text-center">
        {{ side === 'A' ? node.match.left.wins : node.match.right.wins }}
      </span>
      <button
        v-if="side === 'A' ? node.teamAId : node.teamBId"
        type="button"
        :title="
          node.winnerTeamId !== (side === 'A' ? node.teamAId : node.teamBId)
            ? 'Mark as winner'
            : node.winnerIsManual
              ? 'Winner set by hand — click to clear and fall back to the series score'
              : 'Winner from the series score'
        "
        class="shrink-0 w-5 h-5 rounded-full border text-[10px] flex items-center justify-center transition-colors"
        :class="
          node.winnerTeamId !== (side === 'A' ? node.teamAId : node.teamBId)
            ? 'border-zinc-600 text-zinc-500 hover:border-emerald-500 hover:text-emerald-400'
            : node.winnerIsManual
              ? 'bg-amber-500 border-amber-500 text-zinc-900'
              : 'bg-emerald-500 border-emerald-500 text-zinc-900'
        "
        @click="toggleWinner(side)"
      >✓</button>
    </div>

    <div v-if="node.match" class="flex items-center justify-between pt-1 border-t border-border/50">
      <BaseBadge variant="zinc">{{ node.match.matchType }}</BaseBadge>
      <button type="button" class="text-xs text-primary hover:underline" @click="emit('openMatch', node.match.id)">Open match</button>
    </div>
  </div>
</template>
