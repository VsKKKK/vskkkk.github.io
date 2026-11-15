type Tool = { name: string } & ({ logo: string; icon?: never } | { icon: string; logo?: never });

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
  {
    label: '设计系统与前端',
    tools: [
      { name: 'Design Systems', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
      { name: 'Prototyping', icon: 'M3 4h7v6H3zM14 14h7v6h-7zM6.5 10v7H14m-3-3 3 3-3 3' },
      { name: 'HTML/CSS', logo: 'html5' },
      { name: 'React', logo: 'react' },
      { name: 'Tailwind', icon: 'M4 11c2-4 5-5 8-2s6 2 8-2M4 17c2-4 5-5 8-2s6 2 8-2' },
    ],
  },
];
