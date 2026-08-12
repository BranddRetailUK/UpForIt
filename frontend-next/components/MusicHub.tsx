"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent
} from "react";
import {
  cloudinaryArtworkUrl,
  cloudinaryAudioDownloadUrl,
  cloudinaryAudioUrl,
  cloudinaryVideoPosterUrl,
  cloudinaryVideoUrl
} from "../lib/cloudinary";
import {
  filterMusicContent,
  musicBlockMatchesFilter,
  type ArtistStoryBlock,
  type AudioMusicBlock,
  type MusicContentBlock,
  type MusicFilter,
  type ReleaseShowcaseBlock,
  type VideoMusicBlock
} from "../lib/music";

type MusicHubProps = {
  blocks: readonly MusicContentBlock[];
};

type PlaybackProps = {
  activeId: string | null;
  onPlay: (id: string) => void;
};

const FILTERS: Array<{ value: MusicFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "audio", label: "Mixes" },
  { value: "release", label: "Releases" },
  { value: "video", label: "Video" }
];

const WAVEFORM_BARS = [
  34, 58, 78, 48, 88, 64, 40, 72, 96, 54, 30, 68, 82, 44, 74, 92,
  52, 36, 66, 86, 60, 42, 76, 100, 58, 32, 70, 90, 48, 80, 62, 38,
  72, 94, 56, 34, 64, 84, 46, 76, 98, 52, 40, 68, 88, 60, 32, 74
] as const;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function PlayIcon({ playing = false }: { playing?: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h4v14H7zM14 5h4v14h-4z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 5 11 7-11 7z" />
    </svg>
  );
}

function VolumeIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M17 8c2 2 2 6 0 8" />}
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m-5-5 5 5 5-5M5 20h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </svg>
  );
}

function MusicArtwork({
  publicId,
  alt,
  title,
  shape = "square"
}: {
  publicId?: string;
  alt?: string;
  title: string;
  shape?: "square" | "portrait" | "video";
}) {
  const dimensions =
    shape === "portrait"
      ? { width: 720, height: 900 }
      : shape === "video"
        ? { width: 1280, height: 720 }
        : { width: 900, height: 900 };

  if (publicId) {
    const smallWidth = Math.min(480, dimensions.width);
    const smallHeight = Math.round((dimensions.height / dimensions.width) * smallWidth);

    return (
      <img
        className="music-artwork__image"
        src={cloudinaryArtworkUrl(publicId, dimensions)}
        srcSet={`${cloudinaryArtworkUrl(publicId, { width: smallWidth, height: smallHeight })} ${smallWidth}w, ${cloudinaryArtworkUrl(publicId, dimensions)} ${dimensions.width}w`}
        sizes={shape === "square" ? "(max-width: 720px) 100vw, 50vw" : "100vw"}
        width={dimensions.width}
        height={dimensions.height}
        alt={alt || `${title} artwork`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={`music-artwork__placeholder music-artwork__placeholder--${shape}`} aria-label={`${title} artwork uploading`}>
      <span className="music-artwork__burst" aria-hidden="true">★</span>
      <strong>Artwork</strong>
      <span>Uploading</span>
      <i aria-hidden="true">///</i>
    </div>
  );
}

function AudioPlayer({
  block,
  activeId,
  onPlay
}: { block: AudioMusicBlock } & PlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const source = block.mediaPublicId
    ? cloudinaryAudioUrl(block.mediaPublicId, block.format)
    : undefined;
  const canPlay = !block.placeholder && Boolean(source);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    if (activeId !== block.id && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [activeId, block.id]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;

    if (audio.paused) {
      setMediaError(false);
      try {
        await audio.play();
      } catch {
        setMediaError(true);
      }
    } else {
      audio.pause();
    }
  };

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    if (!audioRef.current || !Number.isFinite(nextTime)) return;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    if (!audioRef.current || !Number.isFinite(nextVolume)) return;
    audioRef.current.volume = nextVolume;
    audioRef.current.muted = false;
    setVolume(nextVolume);
    setMuted(false);
  };

  const toggleMuted = () => {
    if (!audioRef.current || !canPlay) return;
    const nextMuted = !audioRef.current.muted;
    audioRef.current.muted = nextMuted;
    setMuted(nextMuted);
  };

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const volumeLevel = muted ? 0 : volume * 100;
  const volumeStyle = { "--range-progress": `${volumeLevel}%` } as CSSProperties;

  return (
    <div className={`mix-audio-player${canPlay ? "" : " is-placeholder"}`}>
      {source ? (
        <audio
          ref={audioRef}
          src={source}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => {
            setPlaying(true);
            onPlay(block.id);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
          }}
          onError={() => setMediaError(true)}
        />
      ) : null}

      <button
        className="mix-audio-player__play"
        type="button"
        onClick={togglePlayback}
        disabled={!canPlay}
        aria-label={`${playing ? "Pause" : "Play"} ${block.title} by ${block.artist}`}
      >
        <PlayIcon playing={playing} />
      </button>

      <div className="mix-audio-player__timeline">
        <div className="mix-audio-player__time" aria-hidden="true">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
        <div className="mix-waveform-control">
          <div className="mix-waveform" aria-hidden="true">
            {WAVEFORM_BARS.map((height, index) => (
              <span
                className={(index / (WAVEFORM_BARS.length - 1)) * 100 <= progress ? "is-played" : undefined}
                style={{ height: `${height}%` }}
                key={`${height}-${index}`}
              />
            ))}
          </div>
          <label className="sr-only" htmlFor={`${block.id}-progress`}>Seek through {block.title}</label>
          <input
            id={`${block.id}-progress`}
            className="mix-range mix-range--waveform"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={seek}
            disabled={!canPlay || duration <= 0}
          />
        </div>
        <span className="mix-audio-player__status" role="status">
          {mediaError ? "Mix unavailable" : canPlay ? (playing ? "Playing now" : "Ready to play") : "Media uploading"}
        </span>
      </div>

      <div className="mix-audio-player__volume">
        <button
          type="button"
          onClick={toggleMuted}
          disabled={!canPlay}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <VolumeIcon muted={muted} />
        </button>
        <label className="sr-only" htmlFor={`${block.id}-volume`}>Volume</label>
        <input
          id={`${block.id}-volume`}
          className="mix-range mix-range--volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={muted ? 0 : volume}
          onChange={changeVolume}
          style={volumeStyle}
          disabled={!canPlay}
        />
      </div>

      {canPlay && block.mediaPublicId ? (
        <a
          className="mix-audio-player__download"
          href={cloudinaryAudioDownloadUrl(
            block.mediaPublicId,
            block.downloadFilename,
            block.format
          )}
          aria-label={`Download ${block.title} by ${block.artist}`}
        >
          <DownloadIcon />
          <span>Download</span>
        </a>
      ) : (
        <span className="mix-audio-player__download is-disabled" aria-hidden="true">
          <DownloadIcon />
          <span>Download</span>
        </span>
      )}
    </div>
  );
}

function AudioCard({
  block,
  activeId,
  onPlay,
  visible
}: { block: AudioMusicBlock; visible: boolean } & PlaybackProps) {
  return (
    <article
      className={`music-card music-card--audio music-card--${block.presentation}`}
      hidden={!visible}
    >
      <div className="music-card__artwork">
        <MusicArtwork publicId={block.artworkPublicId} title={block.title} />
        <span className="music-card__format-sticker">Audio mix</span>
      </div>
      <div className="music-card__copy">
        <p className="music-card__artist">{block.artist}</p>
        <h2>{block.title}</h2>
        <p className="music-card__description">{block.description}</p>
        <AudioPlayer block={block} activeId={activeId} onPlay={onPlay} />
      </div>
    </article>
  );
}

function VideoCard({
  block,
  activeId,
  onPlay,
  visible
}: { block: VideoMusicBlock; visible: boolean } & PlaybackProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const source = block.mediaPublicId
    ? cloudinaryVideoUrl(block.mediaPublicId, block.format)
    : undefined;
  const posterId = block.posterPublicId || block.artworkPublicId;
  const poster = posterId
    ? cloudinaryArtworkUrl(posterId, { width: 1280, height: 720 })
    : block.mediaPublicId
      ? cloudinaryVideoPosterUrl(block.mediaPublicId, { width: 1280, height: 720 })
      : undefined;
  const canPlay = !block.placeholder && Boolean(source);
  const [playing, setPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    if (activeId !== block.id && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [activeId, block.id]);

  const startVideo = async () => {
    if (!videoRef.current || !canPlay) return;
    setMediaError(false);
    try {
      await videoRef.current.play();
    } catch {
      setMediaError(true);
    }
  };

  return (
    <article
      className={`music-card music-card--video music-card--${block.presentation}`}
      hidden={!visible}
    >
      <div className="mix-video-frame">
        {canPlay && source ? (
          <video
            ref={videoRef}
            src={source}
            poster={poster}
            controls
            controlsList="nodownload"
            preload="metadata"
            playsInline
            onPlay={() => {
              setPlaying(true);
              onPlay(block.id);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setMediaError(true)}
            aria-label={`${block.title} by ${block.artist}`}
          />
        ) : (
          <MusicArtwork publicId={posterId} title={block.title} shape="video" />
        )}
        <span className="music-card__format-sticker">Video mix</span>
        {canPlay && !playing && !mediaError ? (
          <button
            className="mix-video-frame__custom-play"
            type="button"
            onClick={startVideo}
            aria-label={`Play ${block.title} by ${block.artist}`}
          >
            <PlayIcon />
            <span>Play mix</span>
          </button>
        ) : null}
        {!canPlay || mediaError ? (
          <div className="mix-video-frame__notice" role="status">
            <span className="mix-video-frame__play" aria-hidden="true"><PlayIcon /></span>
            <strong>{mediaError ? "Video unavailable" : "Media uploading"}</strong>
          </div>
        ) : null}
      </div>
      <div className="music-card__copy music-card__copy--video">
        <div>
          <p className="music-card__artist">{block.artist}</p>
          <h2>{block.title}</h2>
        </div>
        <p className="music-card__description">{block.description}</p>
      </div>
    </article>
  );
}

function ArtistStory({ block, visible }: { block: ArtistStoryBlock; visible: boolean }) {
  return (
    <article className="music-artist-story" hidden={!visible}>
      <div className="music-artist-story__portrait">
        <MusicArtwork publicId={block.imagePublicId} title={block.artist} shape="portrait" />
        <span className="music-card__format-sticker">Artist story</span>
      </div>
      <div className="music-artist-story__copy">
        <p className="comic-kicker comic-kicker--yellow">Meet the artists</p>
        <p className="music-card__artist">{block.artist}</p>
        <h2>{block.title}</h2>
        <p className="music-artist-story__standfirst">{block.description}</p>
        {block.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {block.pullQuote ? <blockquote>“{block.pullQuote}”</blockquote> : null}
      </div>
    </article>
  );
}

function ReleaseShareLink({ block }: { block: ReleaseShowcaseBlock }) {
  const [copied, setCopied] = useState(false);

  const shareRelease = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!navigator.share && !navigator.clipboard) return;

    event.preventDefault();
    const url = event.currentTarget.href;
    const shareText = `Check out ${block.title}\n${url}`;
    const shareData = {
      text: shareText
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!navigator.clipboard) {
        window.location.hash = block.id;
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    }
  };

  return (
    <a
      className="music-release-showcase__share"
      href={`/music?release=${encodeURIComponent(block.id)}#${block.id}`}
      onClick={shareRelease}
    >
      <ShareIcon />
      <span aria-live="polite">{copied ? "Link copied" : "Share release"}</span>
    </a>
  );
}

function ReleaseShowcase({
  block,
  visible
}: {
  block: ReleaseShowcaseBlock;
  visible: boolean;
}) {
  return (
    <article
      className="music-release-showcase"
      id={block.id}
      hidden={!visible}
    >
      <div className="music-release-showcase__hero">
        <div className="music-release-showcase__artwork">
          <MusicArtwork publicId={block.artworkPublicId} title={block.title} />
          <span className="music-card__format-sticker">New release</span>
        </div>

        <div className="music-release-showcase__copy">
          <p className="comic-kicker comic-kicker--pink">UPFORIT resident release</p>
          <p className="music-card__artist">{block.artist}</p>
          <h2>{block.title}</h2>

          <p className="music-release-showcase__standfirst">{block.description}</p>

          <div className="music-release-showcase__actions">
            <a
              className="music-release-showcase__link"
              href={block.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View release on Bandcamp
            </a>
            <ReleaseShareLink block={block} />
          </div>
        </div>
      </div>

      <div className="music-release-showcase__details">
        <div className="music-release-showcase__artist-image">
          <MusicArtwork
            publicId={block.artistImagePublicId}
            title={block.artist}
            alt={`${block.artist}, UPFORIT resident Drum & Bass Artist`}
          />
          <span>UPFORIT resident</span>
        </div>
        <section aria-labelledby={`${block.id}-artist-heading`}>
          <h3 id={`${block.id}-artist-heading`}>About the artist</h3>
          {block.artistBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
        <section aria-labelledby={`${block.id}-label-heading`}>
          <h3 id={`${block.id}-label-heading`}>About Koba Audio</h3>
          {block.labelBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      </div>
    </article>
  );
}

export default function MusicHub({ blocks }: MusicHubProps) {
  const [filter, setFilter] = useState<MusicFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const publishedBlocks = blocks.filter((block) => !block.placeholder);
  const visibleBlocks = filterMusicContent(publishedBlocks, filter);

  const selectFilter = (nextFilter: MusicFilter) => {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
  };

  return (
    <section className="music-hub section-wrap" aria-labelledby="music-feed-heading">
      <div className="music-filter-bar">
        <div>
          <p className="music-filter-bar__eyebrow">Dig through the crate</p>
          <h2 id="music-feed-heading">Latest sessions</h2>
        </div>
        <div className="music-filters" aria-label="Filter music content">
          {FILTERS.map((option) => (
            <button
              type="button"
              className={filter === option.value ? "is-active" : undefined}
              aria-pressed={filter === option.value}
              onClick={() => selectFilter(option.value)}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {visibleBlocks.length} {filter === "all" ? "music and artist" : filter} {visibleBlocks.length === 1 ? "item" : "items"}.
      </p>

      <div className="music-feed">
        {publishedBlocks.map((block) => {
          const visible = musicBlockMatchesFilter(block, filter);
          if (block.kind === "audio") {
            return (
              <AudioCard
                block={block}
                activeId={activeId}
                onPlay={setActiveId}
                visible={visible}
                key={block.id}
              />
            );
          }
          if (block.kind === "video") {
            return (
              <VideoCard
                block={block}
                activeId={activeId}
                onPlay={setActiveId}
                visible={visible}
                key={block.id}
              />
            );
          }
          if (block.kind === "release") {
            return <ReleaseShowcase block={block} visible={visible} key={block.id} />;
          }
          return <ArtistStory block={block} visible={visible} key={block.id} />;
        })}
      </div>
    </section>
  );
}
