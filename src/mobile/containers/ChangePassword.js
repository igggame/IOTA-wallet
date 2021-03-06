import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { translate } from 'react-i18next';
import { StyleSheet, View, Text, TouchableWithoutFeedback, TouchableOpacity, Keyboard } from 'react-native';
import { connect } from 'react-redux';
import { zxcvbn } from 'iota-wallet-shared-modules/libs/exports';
import { setPassword, setSetting } from 'iota-wallet-shared-modules/actions/wallet';
import { passwordReasons } from 'iota-wallet-shared-modules/libs/password';
import { generateAlert } from 'iota-wallet-shared-modules/actions/alerts';
import { changePassword, getPasswordHash } from '../utils/keychain';
import { generatePasswordHash, getRandomBytes } from '../utils/crypto';
import { width, height } from '../utils/dimensions';
import GENERAL from '../theme/general';
import CustomTextInput from '../components/CustomTextInput';
import { Icon } from '../theme/icons.js';
import InfoBox from '../components/InfoBox';
import { leaveNavigationBreadcrumb } from '../utils/bugsnag';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bottomContainer: {
        flex: 1,
        width,
        paddingHorizontal: width / 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topContainer: {
        flex: 11,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    infoText: {
        fontFamily: 'SourceSansPro-Light',
        fontSize: GENERAL.fontSize3,
        textAlign: 'left',
        backgroundColor: 'transparent',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    titleTextLeft: {
        fontFamily: 'SourceSansPro-Regular',
        fontSize: GENERAL.fontSize3,
        backgroundColor: 'transparent',
        marginLeft: width / 20,
    },
    titleTextRight: {
        fontFamily: 'SourceSansPro-Regular',
        fontSize: GENERAL.fontSize3,
        backgroundColor: 'transparent',
        marginRight: width / 20,
    },
});

/**
 * Change Password component
 */
class ChangePassword extends Component {
    static propTypes = {
        /** @ignore */
        password: PropTypes.object.isRequired,
        /** @ignore */
        setPassword: PropTypes.func.isRequired,
        /** @ignore */
        setSetting: PropTypes.func.isRequired,
        /** @ignore */
        generateAlert: PropTypes.func.isRequired,
        /** @ignore */
        theme: PropTypes.object.isRequired,
        /** @ignore */
        t: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            currentPassword: '',
            newPassword: '',
            newPasswordReentry: '',
        };
    }

    componentDidMount() {
        leaveNavigationBreadcrumb('ChangePassword');
    }

    /**
     * Checks validity for user's entered password
     *
     * @method isValid
     * @param {object} currentPwdHash
     *
     * @returns {boolean}
     */
    isValid(currentPwdHash) {
        const { currentPassword, newPassword, newPasswordReentry } = this.state;
        const { password } = this.props;
        const score = zxcvbn(newPassword);

        return (
            isEqual(password, currentPwdHash) &&
            newPassword.length >= 11 &&
            newPasswordReentry.length >= 11 &&
            newPassword === newPasswordReentry &&
            newPassword !== currentPassword &&
            score.score === 4
        );
    }

    /**
     * Changes user password
     *
     * @method changePassword
     *
     * @returns {Promise<*>}
     */
    async changePassword() {
        const { setPassword, generateAlert, t } = this.props;
        const { newPassword, currentPassword } = this.state;

        const currentPwdHash = await getPasswordHash(currentPassword);
        const isValid = this.isValid(currentPwdHash);
        const salt = await getRandomBytes(32);
        const newPwdHash = await generatePasswordHash(newPassword, salt);

        if (isValid) {
            const throwErr = () => generateAlert('error', t('somethingWentWrong'), t('somethingWentWrongTryAgain'));
            changePassword(currentPwdHash, newPwdHash, salt)
                .then(() => {
                    setPassword(newPwdHash);
                    this.fallbackToInitialState();

                    generateAlert('success', t('passwordUpdated'), t('passwordUpdatedExplanation'));

                    this.props.setSetting('securitySettings');
                })
                .catch(() => throwErr());
        }

        return this.renderInvalidSubmissionAlerts(currentPwdHash);
    }

    /**
     * Reset component state properties
     *
     * @method fallbackToInitialState
     */
    fallbackToInitialState() {
        this.setState({
            currentPassword: '',
            newPassword: '',
            newPasswordReentry: '',
        });
    }

    renderTextField(
        ref,
        value,
        label,
        onChangeText,
        returnKeyType,
        onSubmitEditing,
        widget = 'empty',
        isPasswordValid = false,
        passwordStrength = 0,
    ) {
        const { theme } = this.props;
        const props = {
            onRef: ref,
            label,
            onChangeText,
            containerStyle: { width: width / 1.15 },
            autoCapitalize: 'none',
            autoCorrect: false,
            enablesReturnKeyAutomatically: true,
            secureTextEntry: true,
            returnKeyType,
            onSubmitEditing,
            value,
            theme,
            widget,
            isPasswordValid,
            passwordStrength,
        };

        return <CustomTextInput {...props} />;
    }

    /**
     * Generates alert when a user enters an incorrect/invalid password
     *
     * @method renderInvalidSubmissionAlerts
     * @param {object} currentPwdHash
     *
     * @returns {function}
     */
    renderInvalidSubmissionAlerts(currentPwdHash) {
        const { currentPassword, newPassword, newPasswordReentry } = this.state;
        const { password, generateAlert, t } = this.props;
        const score = zxcvbn(newPassword);

        if (!isEqual(password, currentPwdHash)) {
            return generateAlert('error', t('incorrectPassword'), t('incorrectPasswordExplanation'));
        } else if (newPassword !== newPasswordReentry) {
            return generateAlert('error', t('passwordsDoNotMatch'), t('passwordsDoNotMatchExplanation'));
        } else if (newPassword.length < 11 || newPasswordReentry.length < 11) {
            return generateAlert('error', t('passwordTooShort'), t('passwordTooShortExplanation'));
        } else if (newPassword === currentPassword) {
            return generateAlert('error', t('oldPassword'), t('oldPasswordExplanation'));
        } else if (score.score < 4) {
            const reason = score.feedback.warning
                ? t(`changePassword:${passwordReasons[score.feedback.warning]}`)
                : t('changePassword:passwordTooWeakReason');
            return this.props.generateAlert('error', t('changePassword:passwordTooWeak'), reason);
        }

        return null;
    }

    render() {
        const { currentPassword, newPassword, newPasswordReentry } = this.state;
        const { t, theme } = this.props;
        const textColor = { color: theme.body.color };
        const score = zxcvbn(newPassword);
        const isValid = score.score === 4;

        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    <View style={styles.topContainer}>
                        <InfoBox
                            body={theme.body}
                            text={
                                <View>
                                    <Text style={[styles.infoText, textColor]}>{t('ensureStrongPassword')}</Text>
                                </View>
                            }
                        />
                        <View style={{ flex: 0.2 }} />
                        {this.renderTextField(
                            (c) => {
                                this.currentPassword = c;
                            },
                            currentPassword,
                            t('currentPassword'),
                            (password) => this.setState({ currentPassword: password }),
                            'next',
                            () => {
                                if (currentPassword) {
                                    this.newPassword.focus();
                                }
                            },
                        )}
                        {this.renderTextField(
                            (c) => {
                                this.newPassword = c;
                            },
                            newPassword,
                            t('newPassword'),
                            (password) => this.setState({ newPassword: password }),
                            'next',
                            () => {
                                if (newPassword) {
                                    this.newPasswordReentry.focus();
                                }
                            },
                            'password',
                            isValid,
                            score.score,
                        )}
                        {this.renderTextField(
                            (c) => {
                                this.newPasswordReentry = c;
                            },
                            newPasswordReentry,
                            t('confirmPassword'),
                            (password) => this.setState({ newPasswordReentry: password }),
                            'done',
                            () => this.changePassword(),
                            'passwordReentry',
                            isValid && newPassword === newPasswordReentry,
                        )}
                        <View style={{ flex: 0.2 }} />
                    </View>
                    <View style={styles.bottomContainer}>
                        <TouchableOpacity
                            onPress={() => this.props.setSetting('securitySettings')}
                            hitSlop={{ top: height / 55, bottom: height / 55, left: width / 55, right: width / 55 }}
                        >
                            <View style={styles.itemLeft}>
                                <Icon name="chevronLeft" size={width / 28} color={theme.body.color} />
                                <Text style={[styles.titleTextLeft, textColor]}>{t('global:back')}</Text>
                            </View>
                        </TouchableOpacity>
                        {currentPassword !== '' &&
                            newPassword !== '' &&
                            newPasswordReentry !== '' && (
                                <TouchableOpacity
                                    onPress={() => this.changePassword()}
                                    hitSlop={{
                                        top: height / 55,
                                        bottom: height / 55,
                                        left: width / 55,
                                        right: width / 55,
                                    }}
                                >
                                    <View style={styles.itemRight}>
                                        <Text style={[styles.titleTextRight, textColor]}>{t('global:save')}</Text>
                                        <Icon name="tick" size={width / 28} color={theme.body.color} />
                                    </View>
                                </TouchableOpacity>
                            )}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        );
    }
}

const mapStateToProps = (state) => ({
    password: state.wallet.password,
    theme: state.settings.theme,
});

const mapDispatchToProps = {
    setPassword,
    setSetting,
    generateAlert,
};

export default translate(['changePassword', 'global'])(connect(mapStateToProps, mapDispatchToProps)(ChangePassword));
