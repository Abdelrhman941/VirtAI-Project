export const avatarImages = Object.freeze({
  avatar1: Object.freeze({
    id: 'avatar1',
    name: 'Dr. Omar',
    description: 'Empathetic mentor',
    image: '/assets/avatars/avatar1.webp',
    gender: 'male',
  }),
  avatar2: Object.freeze({
    id: 'avatar2',
    name: 'Dr. Mariam',
    description: 'Precise academic guide',
    image: '/assets/avatars/avatar2.webp',
    gender: 'female',
  }),
  avatar3: Object.freeze({
    id: 'avatar3',
    name: 'Dr. Khaled',
    description: 'Narrative teacher',
    image: '/assets/avatars/avatar3.webp',
    gender: 'male',
  }),
});

export const getAvatarById = (id: string) => avatarImages[id as keyof typeof avatarImages] ?? null;
