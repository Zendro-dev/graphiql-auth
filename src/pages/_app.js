import { SessionProvider } from 'next-auth/react';
import { CssBaseline } from '@mui/material';
import '../styles.css'

import { theme } from '../theme';
import { ThemeProvider } from '@mui/material/styles';

import {BASEPATH} from '../config/globals';

export default function App({ Component, pageProps: { session, ...pageProps } }) {

	return (
		<SessionProvider session={session} refetchInterval={9.5 * 60} basePath={ `${BASEPATH}/api/auth` }>
			<ThemeProvider theme={theme}>
				<CssBaseline/>
				<Component {...pageProps} />
			</ThemeProvider>
		</SessionProvider>
	)
}
