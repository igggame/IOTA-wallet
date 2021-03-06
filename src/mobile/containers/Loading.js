import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, View, Text } from 'react-native';
import timer from 'react-native-timer';
import whiteLoadingAnimation from 'iota-wallet-shared-modules/animations/loading-white.json';
import blackLoadingAnimation from 'iota-wallet-shared-modules/animations/loading-black.json';
import whiteWelcomeAnimationPartOne from 'iota-wallet-shared-modules/animations/welcome-part-one-white.json';
import whiteWelcomeAnimationPartTwo from 'iota-wallet-shared-modules/animations/welcome-part-two-white.json';
import blackWelcomeAnimationPartOne from 'iota-wallet-shared-modules/animations/welcome-part-one-black.json';
import blackWelcomeAnimationPartTwo from 'iota-wallet-shared-modules/animations/welcome-part-two-black.json';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import KeepAwake from 'react-native-keep-awake';
import LottieView from 'lottie-react-native';
import {
    getAccountInfo,
    getFullAccountInfoFirstSeed,
    getFullAccountInfoAdditionalSeed,
} from 'iota-wallet-shared-modules/actions/accounts';
import { setLoginRoute } from 'iota-wallet-shared-modules/actions/ui';
import tinycolor from 'tinycolor2';
import { getMarketData, getChartData, getPrice } from 'iota-wallet-shared-modules/actions/marketData';
import { Navigation } from 'react-native-navigation';
import { getCurrencyData } from 'iota-wallet-shared-modules/actions/settings';
import { setSetting } from 'iota-wallet-shared-modules/actions/wallet';
import { changeHomeScreenRoute } from 'iota-wallet-shared-modules/actions/home';
import { generateAlert } from 'iota-wallet-shared-modules/actions/alerts';
import { getSelectedAccountName } from 'iota-wallet-shared-modules/selectors/accounts';
import GENERAL from '../theme/general';
import { getSeedFromKeychain, storeSeedInKeychain } from '../utils/keychain';
import DynamicStatusBar from '../components/DynamicStatusBar';
import StatefulDropdownAlert from './StatefulDropdownAlert';
import { getAddressGenFn, getMultiAddressGenFn } from '../utils/nativeModules';
import { isAndroid } from '../utils/device';
import { leaveNavigationBreadcrumb } from '../utils/bugsnag';
import Button from '../components/Button';

import { width, height } from '../utils/dimensions';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoText: {
        fontFamily: 'SourceSansPro-Regular',
        fontSize: GENERAL.fontSize3,
        backgroundColor: 'transparent',
        textAlign: 'center',
        paddingBottom: height / 30,
    },
    animationLoading: {
        justifyContent: 'center',
        width: width * 1.5,
        height: width / 1.77 * 1.5,
    },
    animationNewSeed: {
        justifyContent: 'center',
        width: width / 2.5,
        height: width / 2.5,
    },
    animationContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: height / 30,
    },
    infoTextContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: height / 20,
    },
    nodeChangeContainer: {
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

/** Loading screen component */
class Loading extends Component {
    static propTypes = {
        /** @ignore */
        firstUse: PropTypes.bool.isRequired,
        /** @ignore */
        addingAdditionalAccount: PropTypes.bool.isRequired,
        /** Navigation object */
        navigator: PropTypes.object.isRequired,
        /** @ignore */
        getAccountInfo: PropTypes.func.isRequired,
        /** @ignore */
        getFullAccountInfoFirstSeed: PropTypes.func.isRequired,
        /** @ignore */
        getFullAccountInfoAdditionalSeed: PropTypes.func.isRequired,
        /** Name for currently selected account */
        selectedAccountName: PropTypes.string.isRequired,
        /** @ignore */
        theme: PropTypes.object.isRequired,
        /** @ignore */
        getMarketData: PropTypes.func.isRequired,
        /** @ignore */
        getPrice: PropTypes.func.isRequired,
        /** @ignore */
        getChartData: PropTypes.func.isRequired,
        /** @ignore */
        getCurrencyData: PropTypes.func.isRequired,
        /** @ignore */
        additionalAccountName: PropTypes.string.isRequired,
        /** @ignore */
        password: PropTypes.object.isRequired,
        /** @ignore */
        seed: PropTypes.string.isRequired,
        /** @ignore */
        currency: PropTypes.string.isRequired,
        /** @ignore */
        t: PropTypes.func.isRequired,
        /** @ignore */
        ready: PropTypes.bool.isRequired,
        /** @ignore */
        setSetting: PropTypes.func.isRequired,
        /** @ignore */
        changeHomeScreenRoute: PropTypes.func.isRequired,
        /** @ignore */
        generateAlert: PropTypes.func.isRequired,
        /** @ignore */
        deepLinkActive: PropTypes.bool.isRequired,
        /** @ignore */
        setLoginRoute: PropTypes.func.isRequired,
    };

    constructor() {
        super();
        this.state = {
            elipsis: '',
            animationPartOneDone: false,
            displayNodeChangeOption: false,
        };
        this.onChangeNodePress = this.onChangeNodePress.bind(this);
    }

    componentDidMount() {
        const {
            firstUse,
            addingAdditionalAccount,
            additionalAccountName,
            selectedAccountName,
            seed,
            password,
            navigator,
            t,
            deepLinkActive,
        } = this.props;
        leaveNavigationBreadcrumb('Loading');
        this.animation.play();
        if (!firstUse && !addingAdditionalAccount) {
            this.setAnimationOneTimout();
            timer.setTimeout('waitTimeout', () => this.onWaitTimeout(), 15000);
        }
        this.getWalletData();
        if ((firstUse || addingAdditionalAccount) && !isAndroid) {
            this.animateElipses(['.', '..', ''], 0);
        }
        KeepAwake.activate();
        if (deepLinkActive) {
            this.props.changeHomeScreenRoute('send');
        } else {
            this.props.changeHomeScreenRoute('balance');
        }
        this.props.setSetting('mainSettings');

        let genFn = null;

        if (firstUse || addingAdditionalAccount) {
            genFn = getMultiAddressGenFn();
        } else {
            genFn = getAddressGenFn();
        }

        if (!firstUse && addingAdditionalAccount) {
            return this.props.getFullAccountInfoAdditionalSeed(
                seed,
                additionalAccountName,
                password,
                storeSeedInKeychain,
                navigator,
                genFn,
            );
        }

        getSeedFromKeychain(password, selectedAccountName).then((currentSeed) => {
            if (currentSeed === null) {
                return this.props.generateAlert(
                    'error',
                    t('global:somethingWentWrong'),
                    t('global:somethingWentWrongRestart'),
                );
            }
            if (firstUse) {
                this.props.getFullAccountInfoFirstSeed(currentSeed, selectedAccountName, navigator, genFn);
            } else {
                this.props.getAccountInfo(currentSeed, selectedAccountName, navigator, genFn);
            }
        });
    }

    componentWillReceiveProps(newProps) {
        const { ready, theme: { body, bar } } = this.props;
        const isReady = !ready && newProps.ready;

        if (isReady) {
            KeepAwake.deactivate();
            this.clearTimeouts();
            // FIXME: A quick workaround to stop history refresh flash on iOS.
            if (isAndroid) {
                this.props.navigator.push({
                    screen: 'home',
                    navigatorStyle: {
                        navBarHidden: true,
                        navBarTransparent: true,
                        topBarElevationShadowEnabled: false,
                        screenBackgroundColor: body.bg,
                        drawUnderStatusBar: true,
                        statusBarColor: bar.alt,
                    },
                    animated: false,
                });
                timer.clearInterval('inactivityTimer');
            } else {
                Navigation.startSingleScreenApp({
                    screen: {
                        screen: 'home',
                        navigatorStyle: {
                            navBarHidden: true,
                            navBarTransparent: true,
                            topBarElevationShadowEnabled: false,
                            screenBackgroundColor: body.bg,
                            drawUnderStatusBar: true,
                            statusBarColor: bar.bg,
                        },
                    },
                    appStyle: {
                        orientation: 'portrait',
                        keepStyleAcrossPush: true,
                    },
                });
            }
        }
    }

    componentWillUnmount() {
        this.clearTimeouts();
    }

    onWaitTimeout() {
        this.setState({ displayNodeChangeOption: true });
    }

    onChangeNodePress() {
        const { theme: { body } } = this.props;
        this.props.setLoginRoute('nodeSelection');
        Navigation.startSingleScreenApp({
            screen: {
                screen: 'login',
                navigatorStyle: {
                    navBarHidden: true,
                    navBarTransparent: true,
                    topBarElevationShadowEnabled: false,
                    screenBackgroundColor: body.bg,
                    drawUnderStatusBar: true,
                    statusBarColor: body.bg,
                },
            },
            appStyle: {
                orientation: 'portrait',
                keepStyleAcrossPush: true,
            },
        });
    }

    getWalletData() {
        const { currency } = this.props;
        this.props.getPrice();
        this.props.getChartData();
        this.props.getMarketData();
        this.props.getCurrencyData(currency);
    }

    setAnimationOneTimout() {
        timer.setTimeout('animationTimeout', () => this.playAnimationTwo(), 2000);
    }

    playAnimationTwo() {
        this.setState({ animationPartOneDone: true });
        this.animation.play();
    }

    clearTimeouts() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        timer.clearTimeout('animationTimeout');
        timer.clearTimeout('waitTimeout');
    }

    animateElipses = (chars, index, time = 750) => {
        this.timeout = setTimeout(() => {
            this.setState({ elipsis: chars[index] });
            const next = index === chars.length - 1 ? 0 : index + 1;
            this.animateElipses(chars, next);
        }, time);
    };

    render() {
        const { firstUse, t, addingAdditionalAccount, theme: { body, primary } } = this.props;
        const { displayNodeChangeOption } = this.state;
        const textColor = { color: body.color };
        const isBgLight = tinycolor(body.bg).isLight();
        const loadingAnimationPath = isBgLight ? blackLoadingAnimation : whiteLoadingAnimation;
        const welcomeAnimationPartOnePath = isBgLight ? blackWelcomeAnimationPartOne : whiteWelcomeAnimationPartOne;
        const welcomeAnimationPartTwoPath = isBgLight ? blackWelcomeAnimationPartTwo : whiteWelcomeAnimationPartTwo;

        if (firstUse || addingAdditionalAccount) {
            return (
                <View style={[styles.container, { backgroundColor: body.bg }]}>
                    <DynamicStatusBar backgroundColor={body.bg} />
                    <View style={{ flex: 1 }} />
                    <View style={styles.animationContainer}>
                        <View>
                            <LottieView
                                ref={(animation) => {
                                    this.animation = animation;
                                }}
                                source={loadingAnimationPath}
                                style={styles.animationNewSeed}
                                loop
                            />
                        </View>
                    </View>
                    <View style={styles.infoTextContainer}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={[styles.infoText, textColor]}>{t('loadingFirstTime')}</Text>
                            <Text style={[styles.infoText, textColor]}>{t('doNotMinimise')}</Text>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={[styles.infoText, textColor]}>{t('thisMayTake')}</Text>
                                <View style={{ alignItems: 'flex-start', width: width / 30 }}>
                                    <Text style={[styles.infoText, textColor]}>
                                        {isAndroid ? '..' : this.state.elipsis}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <StatefulDropdownAlert textColor={body.color} backgroundColor={body.bg} />
                </View>
            );
        }

        return (
            <View style={[styles.container, { backgroundColor: body.bg }]}>
                <DynamicStatusBar backgroundColor={body.bg} />
                <View style={styles.animationContainer}>
                    <View>
                        {(!this.state.animationPartOneDone && (
                            <LottieView
                                ref={(animation) => {
                                    this.animation = animation;
                                }}
                                source={welcomeAnimationPartOnePath}
                                style={styles.animationLoading}
                            />
                        )) || (
                            <LottieView
                                ref={(animation) => {
                                    this.animation = animation;
                                }}
                                source={welcomeAnimationPartTwoPath}
                                style={styles.animationLoading}
                                loop
                            />
                        )}
                    </View>
                    {displayNodeChangeOption && (
                        <View style={styles.nodeChangeContainer}>
                            <Text style={[styles.infoText, textColor]}>{t('takingAWhile')}...</Text>
                            <Button
                                onPress={this.onChangeNodePress}
                                style={{
                                    wrapper: { backgroundColor: primary.color },
                                    children: { color: primary.body },
                                }}
                            >
                                {t('global:changeNode')}
                            </Button>
                        </View>
                    )}
                </View>
                <StatefulDropdownAlert textColor={body.color} backgroundColor={body.bg} />
            </View>
        );
    }
}

const mapStateToProps = (state) => ({
    firstUse: state.accounts.firstUse,
    selectedAccountName: getSelectedAccountName(state),
    addingAdditionalAccount: state.wallet.addingAdditionalAccount,
    additionalAccountName: state.wallet.additionalAccountName,
    seed: state.wallet.seed,
    ready: state.wallet.ready,
    password: state.wallet.password,
    theme: state.settings.theme,
    currency: state.settings.currency,
    deepLinkActive: state.wallet.deepLinkActive,
});

const mapDispatchToProps = {
    changeHomeScreenRoute,
    setSetting,
    getAccountInfo,
    getFullAccountInfoFirstSeed,
    getFullAccountInfoAdditionalSeed,
    getMarketData,
    getPrice,
    getChartData,
    getCurrencyData,
    generateAlert,
    setLoginRoute,
};

export default translate(['loading', 'global'])(connect(mapStateToProps, mapDispatchToProps)(Loading));
