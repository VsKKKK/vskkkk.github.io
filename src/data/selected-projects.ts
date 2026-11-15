import projectData from './projects.json';
const { projects } = projectData;

export const selectedProjects = projects.filter((project) => project.cover);
