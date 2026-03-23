import { ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        {/* K */}
        <rect x="0" y="6" width="6" height="30" fill="var(--icon-strong-base)" />
        <polygon points="6,21 30,6 30,12 9,21" fill="var(--icon-base)" />
        <polygon points="6,21 30,36 30,30 9,21" fill="var(--icon-weak-base)" />

        {/* I */}
        <rect x="42" y="6" width="6" height="30" fill="var(--icon-strong-base)" />

        {/* L */}
        <rect x="60" y="6" width="6" height="30" fill="var(--icon-strong-base)" />
        <path d="M60 30h24v6h-24z" fill="var(--icon-base)" />
        <path d="M78 30h6v6h-6z" fill="var(--icon-weak-base)" />

        {/* O */}
        <path d="M114 6h24v30h-24zM120 12h12v18h-12z" fill="var(--icon-strong-base)" fill-rule="evenodd" />
      </g>
    </svg>
  )
}
