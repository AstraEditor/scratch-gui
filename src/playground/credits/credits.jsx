import React from 'react';
import PropTypes from 'prop-types';
import render from '../app-target';
import styles from './credits.css';

import { APP_NAME } from '../../lib/brand';
import { applyGuiColors } from '../../lib/themes/guiHelpers';
import { detectTheme } from '../../lib/themes/themePersistance';
import UserData from './users';
import AEUserData from './ae-users';
/* eslint-disable react/jsx-no-literals */

applyGuiColors(detectTheme());
document.documentElement.lang = 'en';

const User = ({ image, text, href }) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={styles.user}
    >
        <img
            loading="lazy"
            className={styles.userImage}
            src={image}
            width="60"
            height="60"
        />
        <div className={styles.userInfo}>
            {text}
        </div>
    </a>
);
User.propTypes = {
    image: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    href: PropTypes.string
};

const UserList = ({ users }) => (
    <div className={styles.users}>
        {users.map((data, index) => (
            <User
                key={index}
                {...data}
            />
        ))}
    </div>
);
UserList.propTypes = {
    users: PropTypes.arrayOf(PropTypes.object)
};

const Credits = () => (
    <main className={styles.main}>
        <header className={styles.headerContainer}>
            <h1 className={styles.headerText}>
                {APP_NAME} Credits
            </h1>
        </header>
        <section>
            <p>
                The {APP_NAME} project is made possible by the work of many volunteers.
            </p>
        </section>
        {APP_NAME !== 'TurboWarp' && (
            // Be kind and considerate. Don't remove this :)
            <section>
                <h2>About</h2>
                <p>
                    {APP_NAME} is based on <a href="https://turbowarp.org/">TurboWarp</a>.
                </p>

            </section>

        )}
        <section>
            <p>
                AstraEditor is a modified project based on TurboWarp, but it is not affiliated with other derivative editors or TurboWarp. We extend our sincere gratitude to GarboMuffin, the creator of TurboWarp, and all the volunteers for their outstanding contributions to TurboWarp.
            </p>
        </section>
        <section>
            <h2>Contributors</h2>
            <UserList users={AEUserData.contributors} />
        </section>
        <section>
            <h2>Logo</h2>
            <UserList users={AEUserData.logo} />
        </section>
        <section>
            <h2>Website</h2>
            <UserList users={AEUserData.website} />
        </section>
        <h4 style={{
            textAlign: "center"
        }}>
            The creation of some functions also relies on the collaboration of artificial intelligence(AI)!
        </h4>


        <header className={styles.headerContainerTurboWarp}>
            <h1 className={styles.headerText}>
                TurboWarp Credits
            </h1>
        </header>
        <section>
            <p>
                The TurboWarp project is made possible by the work of many volunteers.
            </p>
        </section>
        <section>
            <h2>Scratch</h2>
            <p>
                TurboWarp is based on the work of the <a href="https://scratch.mit.edu/credits">Scratch contributors</a> but is not endorsed by Scratch in any way.
            </p>
            <p>
                <a href="https://scratch.mit.edu/donate">
                    Donate to support Scratch.
                </a>
            </p>
        </section>
        <section>
            <h2>Contributors</h2>
            <UserList users={UserData.contributors} />
        </section>
        <section>
            <h2>Addons</h2>
            <UserList users={UserData.addonDevelopers} />
        </section>
        <section>
            <h2>TurboWarp Extension Gallery</h2>
            <UserList users={UserData.extensionDevelopers} />
        </section>
        <section>
            <h2>Documentation</h2>
            <UserList users={UserData.docs} />
        </section>
        <section>
            <h2>Translators</h2>
            <p>
                More than 100 people have helped translate TurboWarp and its addons into many languages
                &mdash; far more than we could hope to list here.
            </p>
        </section>
        <section>
            <p>
                <i>
                    Individual contributors are listed in no particular order.
                    The order is randomized each visit.
                </i>
            </p>
        </section>
    </main>
);

render(<Credits />);
