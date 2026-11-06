import React from 'react';

export default function Header({ nav }) {
  return (
    <header className="hdr">
      <div />
      <button className="logo" onClick={nav.home} aria-label="Dnevna Slagalica — početna">
        <span className="logo-top">DNEVNA</span>
        <span className="logo-tiles">{'SLAGALICA'.split('').map((l, i) => <span key={i} className="tile">{l}</span>)}</span>
      </button>
      <div className="hdr-actions">
        <button className="btn btn-big ibtn" onClick={nav.how} aria-label="Kako se igra">?</button>
        <button className="btn btn-big ibtn ibtn-bars" onClick={nav.stats} aria-label="Statistika">
          <span style={{ height: 'clamp(7px,1cqw,13px)' }} /><span style={{ height: 'clamp(12px,1.8cqw,22px)' }} /><span style={{ height: 'clamp(17px,2.6cqw,32px)' }} /><span style={{ height: 'clamp(22px,3.3cqw,42px)' }} />
        </button>
      </div>
    </header>
  );
}
