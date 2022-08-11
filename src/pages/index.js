import dynamic from 'next/dynamic'

import { createStyles, makeStyles } from '@mui/styles';
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import ClientOnly from '../components/client-only';

import {BASEPATH} from '../config/globals';

// import '../node_modules/graphiql/graphiql.css';
const Graphiql = dynamic(
  () => import('../components/graphiql'),
  { ssr: false }
)
export default function Home() {

  const { data: session } = useSession();
  const classes = useStyles();

  if (session) {
    return (
      <div>
        <style global jsx>{`
          html,
          body,
          body > div:first-child,
          div#__next,
          div#__next > div {
            height: 100%;
            width: 100%
          }
        `}</style>
        <Graphiql />
      </div>
    )
  } else {
    return (
      <ClientOnly>
        <style global jsx>{`
          html,
          body,
          body > div:first-child,
          div#__next,
          div#__next > div {
            height: 100%;
            width: 100%
          }
        `}</style>
        <main className={classes.main}>
            <div className={classes.banner} style={{ marginTop: '2rem' }}>
              <img src={ `${BASEPATH}/banner.png` } alt="zendro banner" />
            </div>
              <Button
                size="large"
                variant="outlined"
                color="success"
                endIcon={<LoginIcon />}
                onClick={() => signIn('zendro')}
              >
                LOGIN
              </Button>
            <div className={classes.cardContainer}>
              <a
                className={classes.card}
                href="https://zendro-dev.github.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                <h1>Documentation &rarr;</h1>
                <p>Find in-depth information about Zendro features and API.</p>
              </a>

              <a
                className={classes.card}
                href="https://github.com/Zendro-dev"
                target="_blank"
                rel="noopener noreferrer"
                data-cy="github"
              >
                <h1>Github &rarr;</h1>
                <p>Contribute with pull requests, issues, and feedback.</p>
              </a>
            </div>
        </main>
      </ClientOnly>
    )
  }
}

const useStyles = makeStyles((theme) =>
  createStyles({
    main: {
      display: 'flex',
      flexGrow: 1,
      flexDirection: 'column',
      alignItems: 'center',
      height: '100%',

      // Spacing
      padding: theme.spacing(4, 8),
      [theme.breakpoints.up('sm')]: {
        justifyContent: 'space-evenly',
      },
    },

    login: {
      borderRadius: 5,
      boxShadow: theme.shadows[3],
      padding: '1rem',
    },

    banner: {
      width: '100%',
      maxWidth: theme.breakpoints.values.md,

      margin: theme.spacing(5, 0, 0, 0),
      [theme.breakpoints.up('sm')]: {
        margin: 0,
      },

      '& img': {
        width: '100%',
        objectFit: 'contain',
      },
    },

    cardContainer: {
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      maxWidth: theme.breakpoints.values.md,
      marginTop: theme.spacing(4),
    },

    card: {
      // Dimensions
      width: '100%',

      // Spacing & Layout
      margin: theme.spacing(2, 0),
      padding: theme.spacing(2, 0),
      textDecoration: 'none',
      color: 'inherit',
    
      [theme.breakpoints.up('sm')]: {
        padding: theme.spacing(2, 8),
        flexBasis: '40%',
        '&:nth-child(even)': {
          marginLeft: theme.spacing(2),
        },
      },

      [theme.breakpoints.up('md')]: {
        margin: theme.spacing(2, 7),
      },

      // Palette & Typography
      '&:hover': {
        color: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.background,
      },

      '& h1': {
        ...theme.typography.h6,
        color: theme.palette.primary.dark,
        fontWeight: 'bold',
        [theme.breakpoints.up('sm')]: {
          ...theme.typography.h5,
          color: theme.palette.primary.dark,
          fontWeight: 'bold',
        },
      },
    },
  })
);