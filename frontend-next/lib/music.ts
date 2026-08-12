import type {
  CloudinaryAudioFormat,
  CloudinaryVideoFormat
} from "./cloudinary";

export type MusicFilter = "all" | "audio" | "video" | "release";
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

export type ReleaseShowcaseBlock = MusicBlockBase & {
  kind: "release";
  artist: string;
  artistBody: string[];
  artworkPublicId: string;
  artistImagePublicId: string;
  date: string;
  genre: string;
  label: string;
  labelBody: string[];
  placeholder: false;
  releaseUrl: string;
};

export type MusicContentBlock =
  | AudioMusicBlock
  | VideoMusicBlock
  | ArtistStoryBlock
  | ReleaseShowcaseBlock;

export function musicBlockMatchesFilter(
  block: MusicContentBlock,
  filter: MusicFilter
) {
  if (filter === "all") return true;
  return block.kind === filter;
}

export function filterMusicContent(
  blocks: readonly MusicContentBlock[],
  filter: MusicFilter
) {
  if (filter === "all") return [...blocks];
  return blocks.filter((block) => musicBlockMatchesFilter(block, filter));
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
      "Scott Charles takes us back to our last UPFORIT event with a full MiniMix packed with large amounts of multi genre energy!",
    date: "2026",
    genre: "MiniMix",
    mediaPublicId: "UpForIt_MiniMix_rhs1ez",
    format: "mp4",
    presentation: "featured",
    placeholder: false
  },
  {
    id: "spektral-married-to-the-music-grift",
    kind: "release",
    title: "Married To The Music / Grift",
    artist: "Spektral (UK)",
    description:
      "Two cuts, one clear direction: breakbeats, bass and forward pressure. Married To The Music / Grift sees Spektral (UK) arrive on Koba Audio with a compact drum & bass and jungle double-header.",
    date: "30 May 2026",
    genre: "Drum & Bass / Jungle",
    label: "Koba Audio",
    artworkPublicId: "a1053183844_10_eahqtq",
    artistImagePublicId: "spektral_amzq4l",
    placeholder: false,
    releaseUrl:
      "https://kobaaudio.bandcamp.com/album/married-to-the-music-grift",
    artistBody: [
      "Spektral is a key member of UPFORIT and our resident Drum & Bass Artist, bringing underground selections and high-energy sets to the event. Away from the booth, his recent production run has included releases on Sub Heavy Audio, Rebellion Records and Jungle Tings Audio, alongside a collaboration with E Dappa for Grand Theft Audio. Married To The Music / Grift marks his latest release—and his arrival on Ipswich-based label Koba Audio."
    ],
    labelBody: [
      "Koba Audio is an Ipswich-based drum & bass and jungle label headed by producer and DJ Conrad Subs. Its catalogue dates back to at least 2022 and combines Conrad's own releases—including the Straight Up Jungle series—with music from a widening circle of artists such as Rafiki Dubs, Talisman, DJ Axonal, Steppa Browne and Spektral (UK). The imprint keeps one foot in the sound of '90s jungle while pushing breakbeats and basslines into the present."
    ]
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
      "Meet the artists shaping the sound of UPFORIT",
    body: [
      "We are getting the first artist story ready now. This space will hold interviews, influences and the stories behind each mix.",
      "Check back for the full feature as soon as the final words and portraits land."
    ],
    pullQuote: "Good vibes start with the people behind the music.",
    placeholder: true
  }
];
