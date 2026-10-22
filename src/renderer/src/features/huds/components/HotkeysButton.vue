<script setup lang="ts">
import { ref } from 'vue';
import { API_URL } from '../../../index';
import BaseButton from '@renderer/components/base/BaseButton.vue';

// Reads <hud dir>/hotkeys.json (a HUD's own build step may write one — this HUD's deploy.ps1 does,
// listing every hotkey with the matching panel action) and runs a row's action through the normal
// action channel, exactly like pressing the key would.
const props = defineProps<{ hudId: string }>();

interface HotkeysDoc {
  title: string;
  hint: string;
  items: { key: string; text: string; action: string }[];
}
const hotkeys = ref<HotkeysDoc | null>(null);
const hotkeysError = ref<string | null>(null);
const isOpen = ref(false);

const hudsBaseUrl = API_URL.replace('/api', '/huds');

const open = async () => {
  isOpen.value = true;
  hotkeysError.value = null;
  try {
    const res = await fetch(`${hudsBaseUrl}/${props.hudId}/hotkeys.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(String(res.status));
    hotkeys.value = await res.json();
  } catch (e) {
    hotkeys.value = null;
    hotkeysError.value = e instanceof Error ? e.message : String(e);
  }
};

const run = (action: string) => {
  fetch(`${API_URL}/huds/${props.hudId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hotkey', data: action })
  }).catch(() => {});
};
</script>

<template>
  <BaseButton variant="secondary" @click="open" title="Hotkeys">
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18v10H3zM7 11h1m3 0h1m3 0h1M7 14h10" />
    </svg>
    Hotkeys
  </BaseButton>

  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="isOpen = false">
    <div class="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
      <div v-if="hotkeysError" class="text-red-400 text-sm">hotkeys.json: {{ hotkeysError }}</div>
      <template v-else-if="hotkeys">
        <div class="text-lg font-bold text-text-main mb-1">{{ hotkeys.title }}</div>
        <div class="text-xs text-zinc-400 mb-3">{{ hotkeys.hint }}</div>
        <button
          v-for="item in hotkeys.items"
          :key="item.action"
          type="button"
          @click="run(item.action)"
          class="flex items-center gap-3 w-full text-left px-2.5 py-2 my-0.5 rounded-lg bg-zinc-800 border border-transparent hover:border-primary transition-colors"
        >
          <b class="min-w-[120px] text-primary font-mono text-sm">{{ item.key }}</b>
          <span class="text-sm text-zinc-200">{{ item.text }}</span>
        </button>
      </template>
      <div v-else class="text-zinc-400 text-sm">Loading…</div>
    </div>
  </div>
</template>
