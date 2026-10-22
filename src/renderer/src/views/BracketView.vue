<script setup lang="ts">
import { ref } from 'vue';
import TournamentPicker from '../features/tournaments/components/TournamentPicker.vue';
import TournamentBracket from '../features/tournaments/components/TournamentBracket.vue';

const selectedTournamentId = ref<string | null>(null);
</script>

<template>
  <div class="p-6 bg-surface text-zinc-200 min-h-screen">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-text-main tracking-tight">Bracket</h1>
      <p class="text-zinc-400 text-sm mt-1">Single-elimination tournament brackets — each seeded match is a real entry in Matches.</p>
    </div>

    <TournamentPicker v-model="selectedTournamentId" />
    <TournamentBracket v-if="selectedTournamentId" :tournament-id="selectedTournamentId" />
  </div>
</template>
