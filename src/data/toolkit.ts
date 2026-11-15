type Tool = { name: string; logo: string };

export const toolkit: { label: string; tools: Tool[] }[] = [
  {
    label: '设计工具',
    tools: [
      { name: 'Figma', logo: 'figma' },
      { name: 'Photoshop', logo: 'photoshop' },
      { name: 'Illustrator', logo: 'illustrator' },
      { name: 'Sketch', logo: 'sketch' },
      { name: 'Axure RP', logo: 'axure-rp' },
    ],
  },
  {
    label: 'AI 工具与工作流',
    tools: [
      { name: 'ChatGPT', logo: 'chatgpt' },
      { name: 'Codex', logo: 'codex' },
      { name: 'Cursor', logo: 'cursor' },
      { name: 'Claude', logo: 'claude' },
      { name: 'Midjourney', logo: 'midjourney' },
      { name: '即梦', logo: 'jimeng' },
    ],
  },
];
