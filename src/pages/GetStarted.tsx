import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Home } from 'iconoir-react';

export default function GetStarted() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        .get-started-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #EDEBE6;
          padding: 24px;
          box-sizing: border-box;
        }
        .get-started-brand {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 18px;
          color: #1C1917;
          margin-bottom: 20px;
        }
        .get-started-headline-block {
          margin-bottom: 32px;
          text-align: center;
        }
        .get-started-headline {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 40px;
          color: #1C1917;
          margin: 0 0 8px 0;
        }
        .get-started-subtitle {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 15px;
          color: #1C1917;
          margin: 0;
        }
        .get-started-cards-row {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
          max-width: 600px;
          margin-bottom: 20px;
        }
        .get-started-card {
          background: #E3DDD0;
          border: 1px solid #E0DDD9;
          border-radius: 20px;
          padding: 32px 28px;
          width: 280px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .get-started-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(28,25,23,0.08);
        }
        .get-started-icon-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #1C1917;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .get-started-card-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 19px;
          color: #1C1917;
          margin: 0 0 8px 0;
        }
        .get-started-card-desc {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 13px;
          color: #1C1917;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }
        .get-started-btn {
          width: 100%;
          padding: 13px;
          border-radius: 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: none;
          transition: background 0.2s ease;
          margin-top: auto;
        }
        .btn-action {
          background: #D97706;
          color: #FFFFFF;
        }
        .btn-action:hover {
          background: #B45309;
        }
        .get-started-login-line {
          margin-top: 0;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 13px;
          color: #1C1917;
          text-align: center;
        }
        .get-started-login-link {
          color: #1C1917;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
        }
        .get-started-login-link:hover {
          text-decoration: underline;
        }

        @media (max-height: 700px) {
          .get-started-headline {
            font-size: 32px !important;
          }
          .get-started-card {
            padding: 28px !important;
          }
        }
      `}</style>
      <div className="get-started-container">
        <div className="get-started-brand">
          BlockFlow
        </div>

        <div className="get-started-headline-block">
          <h1 className="get-started-headline">
            Who are you?
          </h1>
          <p className="get-started-subtitle">
            Choose how you want to get started
          </p>
        </div>

        <div className="get-started-cards-row">
          {/* Card 1 - Estate Manager */}
          <div 
            className="get-started-card"
            onClick={() => navigate('/onboarding')}
          >
            <div className="get-started-icon-circle">
              <Building color="#EDEBE6" width={26} height={26} strokeWidth={1.5} />
            </div>
            <h2 className="get-started-card-title">
              Estate Manager
            </h2>
            <p className="get-started-card-desc">
              Setting up a new housing society on BlockFlow?
            </p>
            <button className="get-started-btn btn-action">
              Create Society &rarr;
            </button>
          </div>

          {/* Card 2 - Resident */}
          <div 
            className="get-started-card"
            onClick={() => navigate('/resident-signup')}
          >
            <div className="get-started-icon-circle">
              <Home color="#EDEBE6" width={26} height={26} strokeWidth={1.5} />
            </div>
            <h2 className="get-started-card-title">
              Resident
            </h2>
            <p className="get-started-card-desc">
              Your society is already on BlockFlow? Join and get started.
            </p>
            <button className="get-started-btn btn-action">
              Join My Society &rarr;
            </button>
          </div>
        </div>

        <div className="get-started-login-line">
          Already have an account?{' '}
          <span 
            className="get-started-login-link"
            onClick={() => navigate('/login')}
          >
            Login &rarr;
          </span>
        </div>
      </div>
    </>
  );
}
