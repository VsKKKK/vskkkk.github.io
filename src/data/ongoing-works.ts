import projectData from './projects.json';

const { previews, ...project } = projectData.ongoing;

export const ongoingCovers = previews.map(({ cover, ...preview }) => ({
  ...preview,
  src: `/projects/ongoing/${cover}-1440.webp`,
  srcset: `/projects/ongoing/${cover}-800.webp 800w, /projects/ongoing/${cover}-1440.webp 1440w`,
}));

export const ongoingProject = {
  ...project,
  tags: ongoingCovers.map(({ tag }) => tag),
  cover: ongoingCovers[0].src,
};
