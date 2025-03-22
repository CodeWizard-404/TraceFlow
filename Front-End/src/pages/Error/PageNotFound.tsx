import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaRocket, FaArrowLeft } from "react-icons/fa";
import "./PageNotFound.css";

const PageNotFound: React.FC = () => {
  const navigate = useNavigate();
  const [stars, setStars] = useState<JSX.Element[]>([]);

  // Generate random stars for the background
  useEffect(() => {
    const generateStars = () => {
      const starElements = Array.from({ length: 100 }, (_, i) => {
        const size = Math.random() * 3 + 1;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const animationDelay = Math.random() * 5;
        return (
          <div
            key={i}
            className="star"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${animationDelay}s`,
            }}
          />
        );
      });
      setStars(starElements);
    };
    generateStars();
  }, []);

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="not-found-container">
      {/* Starry Background */}
      <div className="stars-layer">{stars}</div>

      {/* Main Content */}
      <div className="not-found-content">
        {/* Rocket Animation */}
        <div className="rocket-wrapper">
          <FaRocket className="rocket-icon" />
          <div className="rocket-trail"></div>
        </div>

        {/* 404 Text with Glitch Effect */}
        <h1 className="not-found-title">
          <span className="glitch" data-text="404">
            404
          </span>
          <span className="subtitle">Lost in Space</span>
        </h1>

        {/* Message */}
        <p className="not-found-message">
          Oops! It seems you've ventured into the unknown. This page doesn't exist.
        </p>

        {/* Back Button with Hover Effect */}
        <button className="back-btn" onClick={handleBack}>
          <FaArrowLeft /> Return to Orbit
        </button>

        {/* Floating Particles */}
        <div className="particles">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 5 + 5}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Cosmic Wave Effect */}
      <div className="cosmic-waves">
        <div className="wave wave1"></div>
        <div className="wave wave2"></div>
        <div className="wave wave3"></div>
      </div>
    </div>
  );
};

export default PageNotFound;