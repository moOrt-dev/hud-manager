<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { SelectOption } from '../../../components/base/BaseSelect.vue';
import { useTeams } from '../../teams/composables/useTeams';
import { useTournament } from '../composables/useTournament';
import type { ResolvedNode } from '../composables/useTournament';
import BracketMatchCard from './BracketMatchCard.vue';

const props = defineProps<{ tournamentId: string }>();
const router = useRouter();

const { tournament, isLoading, fetchTournament, setSeed, setWinner } = useTournament(() => props.tournamentId);
const { teams, fetchTeams } = useTeams();

onMounted(() => {
  fetchTeams();
  fetchTournament();
});
watch(() => props.tournamentId, fetchTournament);

const teamMap = computed(() => {
  const map: Record<string, { name: string; logo: string }> = {};
  for (const t of teams.value) map[t._id] = { name: t.name, logo: t.logo };
  return map;
});

const teamOptions = computed((): SelectOption[] => teams.value.map((t) => ({ value: t._id, label: t.name })));
const teamLabel = (id: string | null) => (id ? teamMap.value[id]?.name ?? 'Unknown' : 'TBD');
const championLabel = computed(() => teamLabel(tournament.value?.championTeamId ?? null));

// Upper bracket round names, right-aligned to the actual round count (4 teams -> SF+Final, 32 -> all five),
// with the last one relabelled so it isn't confused with the grand final.
const UPPER_ROUND_KEYS = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];
const upperRoundName = (roundCount: number, round: number) => {
  const name = UPPER_ROUND_KEYS.slice(UPPER_ROUND_KEYS.length - roundCount)[round];
  return round === roundCount - 1 ? 'Upper Final' : name;
};
const lowerRoundName = (roundCount: number, round: number) => (round === roundCount - 1 ? 'Lower Final' : `Lower Round ${round + 1}`);

const openMatch = (matchId: string) => router.push(`/matches/${matchId}/edit`);

const onSeed = (slot: number, side: 'A' | 'B', teamId: string | null) => setSeed(slot, side, teamId);
const onWinner = (node: ResolvedNode, side: 'A' | 'B') => {
  const teamId = side === 'A' ? node.teamAId : node.teamBId;
  setWinner(node.bracket, node.round, node.slot, node.winnerTeamId === teamId ? null : teamId);
};
</script>

<template>
  <div v-if="isLoading && !tournament" class="text-zinc-500 text-sm py-8 text-center">Loading…</div>
  <div v-else-if="!tournament" class="text-zinc-500 text-sm py-8 text-center">Select or create a bracket above.</div>

  <template v-else>
    <div v-if="tournament.championTeamId" class="mb-6 bg-amber-500/10 border border-amber-500/40 rounded-xl px-5 py-3 flex items-center gap-2">
      <span class="text-xl">🏆</span>
      <span class="text-text-main font-bold">Champion: {{ championLabel }}</span>
    </div>

    <div class="flex items-center gap-4 mb-5 text-xs text-zinc-500">
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>won on the series score
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>winner set by hand
      </span>
    </div>

    <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">Upper Bracket</h2>
    <div class="flex gap-8 overflow-x-auto pb-4 mb-8">
      <div v-for="(round, r) in tournament.upper" :key="r" class="flex flex-col justify-around gap-4 shrink-0" style="min-width: 260px">
        <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400 text-center mb-1">
          {{ upperRoundName(tournament.upper.length, r) }}
        </h3>
        <BracketMatchCard
          v-for="node in round"
          :key="node.slot"
          :node="node"
          :editable="r === 0"
          :team-options="teamOptions"
          :team-label="teamLabel"
          @seed="(side, teamId) => onSeed(node.slot, side, teamId)"
          @winner="(side) => onWinner(node, side)"
          @open-match="openMatch"
        />
      </div>
    </div>

    <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">Lower Bracket</h2>
    <div class="flex gap-8 overflow-x-auto pb-4 mb-8">
      <div v-for="(round, j) in tournament.lower" :key="j" class="flex flex-col justify-around gap-4 shrink-0" style="min-width: 260px">
        <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400 text-center mb-1">
          {{ lowerRoundName(tournament.lower.length, j) }}
        </h3>
        <BracketMatchCard
          v-for="node in round"
          :key="node.slot"
          :node="node"
          :editable="false"
          :team-options="teamOptions"
          :team-label="teamLabel"
          @winner="(side) => onWinner(node, side)"
          @open-match="openMatch"
        />
      </div>
    </div>

    <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">Grand Final</h2>
    <div class="shrink-0" style="min-width: 260px">
      <BracketMatchCard
        :node="tournament.final"
        :editable="false"
        :team-options="teamOptions"
        :team-label="teamLabel"
        @winner="(side) => onWinner(tournament!.final, side)"
        @open-match="openMatch"
      />
    </div>
  </template>
</template>
