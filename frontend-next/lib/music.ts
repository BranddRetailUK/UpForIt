import type {
  CloudinaryAudioFormat,
  CloudinaryVideoFormat
} from "./cloudinary";

export type MusicFilter = "all" | "audio" | "video";
export type MusicPresentation = "featured" | "wide" | "square";

type MusicBlockBase = {
  id: string;
  title: string;
  description: string;
};

type MusicMediaBase = MusicBlockBase & {
  artist: string;
  artworkPublicId?: string;
  date?: string;
  genre?: string;
  mediaPublicId?: string;
  placeholder: boolean;
  presentation: MusicPresentation;
};

export type AudioMusicBlock = MusicMediaBase & {
  kind: "audio";
  format?: CloudinaryAudioFormat;
  downloadFilename: string;
  presentation: "wide" | "square";
};

export type VideoMusicBlock = MusicMediaBase & {
  kind: "video";
  format?: CloudinaryVideoFormat;
  posterPublicId?: string;
  presentation: "featured" | "wide";
};

export type ArtistStoryBlock = MusicBlockBase & {
  kind: "artist-story";
  artist: string;
  body: string[];
  imagePublicId?: string;
  pullQuote?: string;
  placeholder: boolean;
};

export type MusicContentBlock =
  | AudioMusicBlock
  | VideoMusicBlock
  | ArtistStoryBlock;

export function filterMusicContent(
  blocks: readonly MusicContentBlock[],
  filter: MusicFilter
) {
  if (filter === "all") return [...blocks];
  return blocks.filter((block) => block.kind === filter);
}

// Replace the placeholder copy and add Cloudinary public IDs here when the
// launch media is ready. Components do not need to change when content lands.
export const MUSIC_CONTENT: readonly MusicContentBlock[] = [
  {
    id: "featured-main-room-video",
    kind: "video",
    title: "UPFORIT MiniMix 2026",
    artist: "Scott Charles",
    description:
      "Scott Charles takes us back to our last UPFORIT event with a full MiniMix packed with proper party energy.",
    date: "2026",
    genre: "MiniMix",
    mediaPublicId: "UpForIt_MiniMix_rhs1ez",
    format: "mp4",
    presentation: "featured",
    placeholder: false
  },
  {
    id: "warm-up-audio",
    kind: "audio",
    title: "UPFORIT MiniMix 2026",
    artist: "Scott Charles",
    description:
      "Listen back to Scott Charles's MiniMix from our last event, or download it and take the UPFORIT energy with you.",
    date: "2026",
    genre: "MiniMix",
    mediaPublicId: "Scott_Charles_-_Up_For_It_MiniMix_2026_smkqax",
    artworkPublicId: "378791832_342695141429926_6804341155809596322_n_xlhaks",
    format: "mp3",
    presentation: "wide",
    placeholder: false,
    downloadFilename: "scott-charles-upforit-minimix-2026"
  },
  {
    id: "after-dark-audio",
    kind: "audio",
    title: "After Dark",
    artist: "Artist TBA",
    description: "Big hooks, bold drums and late-night selections. Artwork and audio uploading now.",
    genre: "Club mix",
    presentation: "square",
    placeholder: true,
    downloadFilename: "upforit-after-dark"
  },
  {
    id: "sunrise-selects-audio",
    kind: "audio",
    title: "Sunrise Selects",
    artist: "Artist TBA",
    description: "The final stretch of the night, packed into one feel-good session.",
    genre: "Closing set",
    presentation: "square",
    placeholder: true,
    downloadFilename: "upforit-sunrise-selects"
  },
  {
    id: "behind-the-booth-story",
    kind: "artist-story",
    title: "Behind the Booth",
    artist: "Artist spotlight coming soon",
    description:
      "Meet the selectors shaping the sound of UPFORIT and find out what keeps them reaching for the next tune.",
    body: [
      "We are getting the first artist story ready now. This space will hold interviews, influences and the stories behind each mix.",
      "Check back for the full feature as soon as the final words and portraits land."
    ],
    pullQuote: "Good vibes start with the people behind the music.",
    placeholder: true
  },
  {
    id: "crowd-control-video",
    kind: "video",
    title: "Crowd Control",
    artist: "Guest artist TBA",
    description:
      "A second video session is being lined up, bringing a different sound and another side of the party.",
    date: "Coming soon",
    genre: "Guest session",
    presentation: "wide",
    placeholder: true
  }
];
