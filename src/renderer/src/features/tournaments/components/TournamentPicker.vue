<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BaseButton from '../../../components/base/BaseButton.vue';
import BaseSelect from '../../../components/base/BaseSelect.vue';
import type { SelectOption } from '../../../components/base/BaseSelect.vue';
import BaseInput from '../../../components/base/BaseInput.vue';
import { useTournaments } from '../composables/useTournaments';

const props = defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{
  'update:modelValue': [string | null];
}>();

const { tournaments, fetchTournaments, createTournament, deleteTournament } = useTournaments();

const tournamentOptions = ref<SelectOption[]>([]);
const syncOptions = () => {
  tournamentOptions.value = tournaments.value.map((t) => ({ value: t.id, label: `${t.name || 'Untitled'} (${t.size})` }));
};

const isCreating = ref(false);
const newName = ref('');
const newSize = ref<4 | 8 | 16 | 32>(8);
const SIZES = [4, 8, 16, 32] as const;

onMounted(async () => {
  await fetchTournaments();
  syncOptions();
  if (!props.modelValue && tournaments.value.length) emit('update:modelValue', tournaments.value[0].id);
});

const openCreate = () => {
  newName.value = '';
  newSize.value = 8;
  isCreating.value = true;
};

const confirmCreate = async () => {
  const created = await createTournament(newName.value.trim() || 'Bracket', newSize.value);
  syncOptions();
  isCreating.value = false;
  emit('update:modelValue', created.id);
};

const removeCurrent = async () => {
  if (!props.modelValue) return;
  const ok = await deleteTournament(props.modelValue);
  if (!ok) return;
  syncOptions();
  emit('update:modelValue', tournaments.value[0]?.id ?? null);
};
</script>

<template>
  <div class="flex items-center gap-3 mb-4 flex-wrap">
    <BaseSelect
      v-if="tournamentOptions.length"
      :model-value="modelValue ?? undefined"
      :options="tournamentOptions"
      placeholder="Select a bracket"
      size="md"
      @update:model-value="(v) => emit('update:modelValue', (v as string) ?? null)"
    />
    <span v-else class="text-sm text-zinc-500">No brackets yet.</span>

    <BaseButton variant="primary" size="sm" @click="openCreate">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
      New bracket
    </BaseButton>

    <BaseButton v-if="modelValue" variant="danger" size="sm" @click="removeCurrent">Delete bracket</BaseButton>
  </div>

  <div v-if="isCreating" class="bg-zinc-800 border border-border rounded-xl p-4 mb-4 flex items-end gap-4 flex-wrap">
    <BaseInput v-model="newName" label="Name" placeholder="e.g. Playoffs" size="md" />
    <div>
      <label class="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Teams</label>
      <div class="flex gap-2">
        <BaseButton
          v-for="s in SIZES" :key="s"
          :variant="newSize === s ? 'primary' : 'secondary'"
          size="sm"
          @click="newSize = s"
        >{{ s }}</BaseButton>
      </div>
    </div>
    <BaseButton variant="primary" @click="confirmCreate">Create</BaseButton>
    <BaseButton variant="secondary" @click="isCreating = false">Cancel</BaseButton>
  </div>
</template>
