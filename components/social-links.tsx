import React from "react";
import { Button } from "./ui/button";
import Image from "next/image";

import { trackSocialClick } from "@/lib/firebase-analytics";

const SocialLinks = () => {
  const socialLinks: { label: string; url: string; icon: string }[] = [
    {
      label: "Email",
      url: "mailto:zasturman@gmail.com",
      icon: "/icons/email.svg",
    },
    {
      label: "GitHub",
      url: "https://github.com/ZSturman",
      icon: "/icons/github.svg",
    },
    {
      label: "LinkedIn",
      url: "https://www.linkedin.com/in/zacharysturman/",
      icon: "/icons/linkedin.svg",
    },
    {
      label: "Hasnode",
      url: "https://zacharysturman.hashnode.dev",
      icon: "/icons/hashnode.svg",
    },
  ];

  return (
    <div
      className="flex flex-wrap justify-center md:justify-start gap-4"
      data-nosnippet
    >
      {socialLinks.map((link) => (
        <SocialLink
          key={link.url}
          label={link.label}
          url={link.url}
          icon={link.icon}
        />
      ))}
    </div>
  );
};

export default SocialLinks;

const SocialLink = ({
  label,
  url,
  icon,
}: {
  label: string;
  url: string;
  icon: string;
}) => {
  return (
    <Button
      key={url}
      variant="ghost"
      size="icon"
      className="p-0 border-0 hover:cursor-pointer "
      onClick={() => {
        trackSocialClick({
          socialNetwork: label,
          destinationUrl: url,
        });
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      aria-label={label}
    >
      <Image
        src={icon}
        alt={label}
        className="h-5 w-5 dark:invert"
        width={20}
        height={20}
      />
    </Button>
  );
};
