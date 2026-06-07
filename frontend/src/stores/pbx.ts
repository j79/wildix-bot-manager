import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PbxState {
  selectedPbxId: string
  setSelectedPbxId: (id: string) => void
}

export const usePbxStore = create<PbxState>()(
  persist(
    (set) => ({
      selectedPbxId: '',
      setSelectedPbxId: (id) => set({ selectedPbxId: id }),
    }),
    { name: 'wilma-pbx' },
  ),
)
