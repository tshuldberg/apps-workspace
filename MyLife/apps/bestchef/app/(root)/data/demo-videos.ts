import { DEMO_CHEFS, DEMO_DISHES } from './demo';

export interface DemoVideo {
  id: string;
  submissionId?: string;
  /** Cloud social_profiles id when known; demo fixtures have none. */
  chefProfileId?: string;
  dishId: string;
  dishName: string;
  cuisine: string;
  chefName: string;
  chefHandle: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number;
  likes: number;
  comments: number;
  shares: number;
}

const VIDEO_URLS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
];

export const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: 'v1',
    submissionId: 's1',
    dishId: 'd1',
    dishName: 'Pad Thai',
    cuisine: 'Thai',
    chefName: DEMO_CHEFS[0].displayName,
    chefHandle: DEMO_CHEFS[0].handle,
    title: 'Street Pad Thai from Scratch',
    description: 'Full walkthrough of authentic Bangkok street cart pad thai with wok hei technique',
    videoUrl: VIDEO_URLS[0],
    duration: 596,
    likes: 847,
    comments: 23,
    shares: 12,
  },
  {
    id: 'v2',
    submissionId: 's4',
    dishId: 'd2',
    dishName: 'Carbonara',
    cuisine: 'Italian',
    chefName: DEMO_CHEFS[3].displayName,
    chefHandle: DEMO_CHEFS[3].handle,
    title: 'Roman Carbonara Masterclass',
    description: 'The only carbonara tutorial you need. Guanciale, pecorino, eggs, pepper.',
    videoUrl: VIDEO_URLS[1],
    duration: 660,
    likes: 921,
    comments: 45,
    shares: 31,
  },
  {
    id: 'v3',
    submissionId: 's7',
    dishId: 'd4',
    dishName: 'Ramen',
    cuisine: 'Japanese',
    chefName: DEMO_CHEFS[6].displayName,
    chefHandle: DEMO_CHEFS[6].handle,
    title: '18-Hour Tonkotsu Broth',
    description: 'The full process: pork bone broth, chashu, ajitama, and homemade noodles',
    videoUrl: VIDEO_URLS[2],
    duration: 900,
    likes: 934,
    comments: 67,
    shares: 44,
  },
  {
    id: 'v4',
    submissionId: 's8',
    dishId: 'd5',
    dishName: 'Butter Chicken',
    cuisine: 'Indian',
    chefName: DEMO_CHEFS[7].displayName,
    chefHandle: DEMO_CHEFS[7].handle,
    title: 'Delhi Butter Chicken',
    description: 'The real Moti Mahal recipe with tandoori chicken and creamy tomato sauce',
    videoUrl: VIDEO_URLS[3],
    duration: 720,
    likes: 867,
    comments: 38,
    shares: 19,
  },
  {
    id: 'v5',
    submissionId: 's6',
    dishId: 'd3',
    dishName: 'Tacos al Pastor',
    cuisine: 'Mexican',
    chefName: DEMO_CHEFS[5].displayName,
    chefHandle: DEMO_CHEFS[5].handle,
    title: 'Trompo al Pastor at Home',
    description: '24-hour achiote marinade, pineapple, guajillo chiles on a DIY vertical spit',
    videoUrl: VIDEO_URLS[0],
    duration: 540,
    likes: 856,
    comments: 29,
    shares: 22,
  },
  {
    id: 'v6',
    submissionId: 's9',
    dishId: 'd6',
    dishName: 'Pho',
    cuisine: 'Vietnamese',
    chefName: DEMO_CHEFS[8].displayName,
    chefHandle: DEMO_CHEFS[8].handle,
    title: 'Saigon Pho Bo',
    description: 'Southern-style pho with bone broth, star anise, cinnamon, and fresh herbs',
    videoUrl: VIDEO_URLS[1],
    duration: 780,
    likes: 801,
    comments: 41,
    shares: 17,
  },
  {
    id: 'v7',
    submissionId: 's3',
    dishId: 'd1',
    dishName: 'Pad Thai',
    cuisine: 'Thai',
    chefName: DEMO_CHEFS[2].displayName,
    chefHandle: DEMO_CHEFS[2].handle,
    title: 'Vegan Pad Thai',
    description: 'Plant-based pad thai packed with umami. No fish sauce, all flavor.',
    videoUrl: VIDEO_URLS[2],
    duration: 420,
    likes: 612,
    comments: 18,
    shares: 9,
  },
  {
    id: 'v8',
    dishId: 'd8',
    dishName: 'Bibimbap',
    cuisine: 'Korean',
    chefName: DEMO_CHEFS[4].displayName,
    chefHandle: DEMO_CHEFS[4].handle,
    title: 'Dolsot Bibimbap in a Stone Bowl',
    description: 'Crispy rice, gochujang, perfectly seared banchan, and a runny egg',
    videoUrl: VIDEO_URLS[3],
    duration: 480,
    likes: 723,
    comments: 33,
    shares: 15,
  },
  {
    id: 'v9',
    dishId: 'd15',
    dishName: 'Dumplings',
    cuisine: 'Chinese',
    chefName: DEMO_CHEFS[2].displayName,
    chefHandle: DEMO_CHEFS[2].handle,
    title: 'Hand-Pleated Pork Dumplings',
    description: 'From dough to pan-fry. 200 dumplings in one batch cook session.',
    videoUrl: VIDEO_URLS[0],
    duration: 600,
    likes: 788,
    comments: 52,
    shares: 28,
  },
  {
    id: 'v10',
    submissionId: 's10',
    dishId: 'd10',
    dishName: 'Tiramisu',
    cuisine: 'Italian',
    chefName: DEMO_CHEFS[3].displayName,
    chefHandle: DEMO_CHEFS[3].handle,
    title: "Nonna's Tiramisu",
    description: 'Classic Italian tiramisu with mascarpone, espresso, and Marsala wine',
    videoUrl: VIDEO_URLS[1],
    duration: 360,
    likes: 756,
    comments: 27,
    shares: 21,
  },
];

export function getVideosForDish(dishId: string): DemoVideo[] {
  return DEMO_VIDEOS.filter((v) => v.dishId === dishId);
}

export function getVideosForCuisine(cuisine: string): DemoVideo[] {
  return DEMO_VIDEOS.filter(
    (v) => v.cuisine.toLowerCase() === cuisine.toLowerCase(),
  );
}

export function getAllVideos(): DemoVideo[] {
  return DEMO_VIDEOS;
}

export function getVideoLikeCountForSubmission(submissionId: string): number | null {
  return DEMO_VIDEOS.find((video) => video.submissionId === submissionId)?.likes ?? null;
}
