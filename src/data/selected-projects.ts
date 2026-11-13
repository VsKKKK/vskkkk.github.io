import projects from './projects.json';

export const selectedProjects = projects.filter((project) => project.cover);
